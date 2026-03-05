import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { createAdminClient } from "@/lib/supabaseServer";
import { getInboundDfeById } from "@/lib/fiscal/inbound/service";
import { decodeInboundXml } from "@/lib/fiscal/inbound/xml-utils";

export const runtime = "nodejs";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const params = ParamsSchema.parse(await context.params);
    const company = await resolveCompanyContext();
    const admin = createAdminClient();

    const inbound = await getInboundDfeById(admin, {
      companyId: company.companyId,
      id: params.id,
    });

    if (!inbound) {
      return NextResponse.json({ error: "NF-e de entrada não encontrada" }, { status: 404 });
    }

    if (!inbound.xml_base64) {
      return NextResponse.json({ error: "XML completo não disponível para esta NF-e" }, { status: 404 });
    }

    const xml = decodeInboundXml({
      xmlBase64: inbound.xml_base64,
      xmlIsGz: inbound.xml_is_gz,
    });

    const fileId = inbound.chnfe ?? inbound.nsu;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="nfe-entrada-${fileId}.xml"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao baixar XML";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
