import { NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { generatePdfFromHtml } from "@/lib/print/pdf-generator";
import { renderInventoryCountA4Html } from "@/lib/templates/print/inventory-count-a4";
import { getInventoryCountPrintData } from "@/lib/inventory/inventory-counts";
import { resolveCompanyLogoDataUri } from "@/lib/fiscal/nfe/logo-resolver";
import { logger } from "@/lib/logger";

interface CompanySettingsRow {
  legal_name: string | null;
  trade_name: string | null;
  cnpj: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
}

function mapCompanySettingsRow(value: unknown): CompanySettingsRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  return {
    legal_name: typeof candidate.legal_name === "string" ? candidate.legal_name : null,
    trade_name: typeof candidate.trade_name === "string" ? candidate.trade_name : null,
    cnpj: typeof candidate.cnpj === "string" ? candidate.cnpj : null,
    address_street: typeof candidate.address_street === "string" ? candidate.address_street : null,
    address_number: typeof candidate.address_number === "string" ? candidate.address_number : null,
    address_neighborhood: typeof candidate.address_neighborhood === "string" ? candidate.address_neighborhood : null,
    address_city: typeof candidate.address_city === "string" ? candidate.address_city : null,
    address_state: typeof candidate.address_state === "string" ? candidate.address_state : null,
  };
}

function resolveCompanyAddressLines(settings: CompanySettingsRow | null): {
  streetLine: string | null;
  cityStateLine: string | null;
} {
  if (!settings) {
    return { streetLine: null, cityStateLine: null };
  }

  const streetLine = [settings.address_street, settings.address_number].filter(Boolean).join(", ") || null;
  const cityStateLine = [settings.address_neighborhood, settings.address_city, settings.address_state]
    .filter(Boolean)
    .join(" - ") || null;

  return { streetLine, cityStateLine };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { supabase, companyId } = await resolveCompanyContext();

    const printData = await getInventoryCountPrintData(supabase, companyId, id);

    const { data: settingsData, error: settingsError } = await supabase
      .from("company_settings")
      .select("legal_name, trade_name, cnpj, address_street, address_number, address_neighborhood, address_city, address_state")
      .eq("company_id", companyId)
      .maybeSingle();

    if (settingsError) {
      throw new Error(`Falha ao carregar dados da empresa para impressão: ${settingsError.message}`);
    }

    const settings = mapCompanySettingsRow(settingsData);
    const logoDataUri = await resolveCompanyLogoDataUri(supabase, companyId);
    const addressLines = resolveCompanyAddressLines(settings);

    const html = renderInventoryCountA4Html({
      company: {
        legalName: settings?.legal_name || settings?.trade_name || "EMPRESA",
        tradeName: settings?.trade_name || null,
        document: settings?.cnpj || null,
        streetLine: addressLines.streetLine,
        cityStateLine: addressLines.cityStateLine,
        logoUrl: logoDataUri ?? null,
      },
      inventory: printData,
    });

    const pdfBuffer = await generatePdfFromHtml(html, {
      displayHeaderFooter: false,
      margin: {
        top: "0",
        bottom: "0",
        left: "0",
        right: "0",
      },
    });
    const number = printData.number ?? 0;
    const fileName = `inventario_${String(number).padStart(6, "0")}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado ao gerar PDF de inventário.";
    logger.error("[inventory/counts/print] Failed to generate inventory count PDF", { message });

    if (message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Inventário não encontrado")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
