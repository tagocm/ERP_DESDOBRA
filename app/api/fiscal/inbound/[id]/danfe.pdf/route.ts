import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInboundDfeById } from "@/lib/fiscal/inbound/service";
import { decodeInboundXml } from "@/lib/fiscal/inbound/xml-utils";
import { generateDanfePdf, type DanfeEmitterOverride } from "@/lib/danfe/pdfService";
import { resolveCompanyLogoDataUri, resolveCompanyLogoUrl } from "@/lib/fiscal/nfe/logo-resolver";

export const runtime = "nodejs";
export const maxDuration = 60;

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

const CompanySettingsSchema = z.object({
  legal_name: z.string().nullable().optional(),
  trade_name: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  ie: z.string().nullable().optional(),
  address_street: z.string().nullable().optional(),
  address_number: z.string().nullable().optional(),
  address_neighborhood: z.string().nullable().optional(),
  address_city: z.string().nullable().optional(),
  address_state: z.string().nullable().optional(),
  address_zip: z.string().nullable().optional(),
});

function buildEmitterOverride(settings: z.infer<typeof CompanySettingsSchema> | null): DanfeEmitterOverride | undefined {
  if (!settings) return undefined;
  return {
    xNome: settings.legal_name || settings.trade_name || null,
    cnpj: settings.cnpj || null,
    ie: settings.ie || null,
    enderEmit: {
      xLgr: settings.address_street || null,
      nro: settings.address_number || null,
      xBairro: settings.address_neighborhood || null,
      xMun: settings.address_city || null,
      uf: settings.address_state || null,
      cep: settings.address_zip || null,
    },
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const params = ParamsSchema.parse(await context.params);
    const companyCtx = await resolveCompanyContext();
    const admin = createAdminClient();

    const inbound = await getInboundDfeById(admin, {
      companyId: companyCtx.companyId,
      id: params.id,
    });

    if (!inbound) {
      return NextResponse.json({ error: "NF-e de entrada não encontrada" }, { status: 404 });
    }

    if (!inbound.xml_base64 || !inbound.has_full_xml) {
      return NextResponse.json(
        { error: "DANFE indisponível: XML completo não foi baixado ainda." },
        { status: 409 },
      );
    }

    const xml = decodeInboundXml({
      xmlBase64: inbound.xml_base64,
      xmlIsGz: inbound.xml_is_gz,
    });

    const { data: rawSettings, error: settingsError } = await admin
      .from("company_settings")
      .select(
        "legal_name,trade_name,cnpj,ie,address_street,address_number,address_neighborhood,address_city,address_state,address_zip",
      )
      .eq("company_id", companyCtx.companyId)
      .maybeSingle();

    if (settingsError) {
      throw new Error(`Falha ao carregar dados da empresa para DANFE: ${settingsError.message}`);
    }

    const settings = CompanySettingsSchema.parse(rawSettings ?? null);
    const logoUrl =
      (await resolveCompanyLogoDataUri(admin, companyCtx.companyId)) ||
      (await resolveCompanyLogoUrl(admin, companyCtx.companyId));

    const pdf = await generateDanfePdf(
      xml,
      companyCtx.companyId,
      logoUrl || undefined,
      buildEmitterOverride(settings),
    );

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="danfe-entrada-${inbound.chnfe ?? inbound.nsu}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar DANFE";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
