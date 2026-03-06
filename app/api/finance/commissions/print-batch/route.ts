import archiver from "archiver";
import { NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { buildCommissionSettlementPrintDocument } from "@/lib/finance/commissions/print";
import { logger } from "@/lib/logger";
import { generatePdfFromHtml } from "@/lib/print/pdf-generator";
import { renderCommissionSettlementA4Html } from "@/lib/templates/print/commission-settlement-a4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BatchPrintRequestBody {
  ids: string[];
}

function zipPdfs(files: Array<{ filename: string; buffer: Buffer }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk) => {
      chunks.push(chunk as Buffer);
    });
    archive.on("error", (error) => {
      reject(error);
    });
    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    for (const file of files) {
      archive.append(file.buffer, { name: file.filename });
    }

    void archive.finalize();
  });
}

function buildCombinedHtml(htmlPages: string[]): string {
  if (htmlPages.length === 0) {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <style>body { margin: 0; }</style>
        </head>
        <body></body>
      </html>
    `;
  }

  const extractedBodies = htmlPages.map((html) => html.match(/<body>([\s\S]*)<\/body>/i)?.[1] ?? html);
  const extractedStyle = htmlPages[0]?.match(/<style>([\s\S]*)<\/style>/i)?.[1] ?? "";

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <style>
          ${extractedStyle}
          .batch-page-break {
            break-before: page;
            page-break-before: always;
            display: block;
            height: 1px;
            width: 100%;
          }
        </style>
      </head>
      <body>
        ${extractedBodies.join('<div class="batch-page-break"></div>')}
      </body>
    </html>
  `;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const modeParam = searchParams.get("mode");
    const mode = modeParam === "zip" ? "zip" : "pdf";

    const body = (await request.json()) as BatchPrintRequestBody;
    const ids = Array.isArray(body.ids) ? body.ids.filter((value) => typeof value === "string" && value.length > 0) : [];
    const uniqueIds = Array.from(new Set(ids));

    if (uniqueIds.length === 0) {
      return NextResponse.json({ error: "Nenhum acerto selecionado." }, { status: 400 });
    }

    if (uniqueIds.length > 50) {
      return NextResponse.json({ error: "Limite de 50 acertos por lote excedido." }, { status: 400 });
    }

    const { supabase, companyId } = await resolveCompanyContext();

    const documents = await Promise.all(
      uniqueIds.map((settlementId) => buildCommissionSettlementPrintDocument(supabase, companyId, settlementId)),
    );

    if (mode === "zip") {
      const files: Array<{ filename: string; buffer: Buffer }> = [];

      for (const document of documents) {
        const html = renderCommissionSettlementA4Html(document.data);
        const pdfBuffer = await generatePdfFromHtml(html, {
          displayHeaderFooter: false,
          margin: { top: "0", bottom: "0", left: "0", right: "0" },
        });
        files.push({
          filename: `acerto_comissao_${document.displayNumber}.pdf`,
          buffer: pdfBuffer,
        });
      }

      const zipBuffer = await zipPdfs(files);
      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="acertos_comissao_${new Date().toISOString().slice(0, 10)}.zip"`,
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    const htmlPages = documents.map((document) => renderCommissionSettlementA4Html(document.data));
    const combinedHtml = buildCombinedHtml(htmlPages);
    const pdfBuffer = await generatePdfFromHtml(combinedHtml, {
      displayHeaderFooter: false,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="acertos_comissao_consolidado_${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada ao gerar impressão em lote.";
    logger.error("[finance/commissions/print-batch] failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
