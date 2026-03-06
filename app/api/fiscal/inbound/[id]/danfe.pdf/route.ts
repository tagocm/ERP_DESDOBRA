import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInboundDfeById } from "@/lib/fiscal/inbound/service";
import { decodeInboundXml } from "@/lib/fiscal/inbound/xml-utils";
import { generateDanfePdf } from "@/lib/danfe/pdfService";

export const runtime = "nodejs";
export const maxDuration = 60;

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

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

    // DANFE de entrada deve refletir fielmente o XML recebido:
    // emitente = fornecedor emissor da NF-e / destinatário = empresa (nosso CNPJ).
    // Não aplicamos override de emitente nem logo neste modo.
    const pdf = await generateDanfePdf(xml, companyCtx.companyId);

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
