export const runtime = "nodejs";
export const maxDuration = 120;

import archiver from "archiver";
import { NextRequest, NextResponse } from "next/server";
import { PassThrough, Readable } from "stream";
import { z } from "zod";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabaseServer";
import { decodeInboundXml } from "@/lib/fiscal/inbound/xml-utils";

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

const InboundZipRowSchema = z.object({
  id: z.string().uuid(),
  nsu: z.string(),
  chnfe: z.string().nullable(),
  xml_base64: z.string().nullable(),
  xml_is_gz: z.boolean(),
});

function sanitizeFileNamePart(value: string): string {
  return value.trim().replace(/[^\w.-]+/g, "_");
}

function getZipName(): string {
  return `xml_entrada_lote_${new Date().toISOString().slice(0, 10)}.zip`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const limit = rateLimit(req, { key: "inbound-nfe-batch-zip", limit: 10, windowMs: 60_000 });
    if (!limit.ok) {
      return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
    }

    const context = await resolveCompanyContext();
    const admin = createAdminClient();

    const parsedBody = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const ids = Array.from(new Set(parsedBody.data.ids));
    const { data, error } = await admin
      .from("fiscal_inbound_dfe")
      .select("id,nsu,chnfe,xml_base64,xml_is_gz")
      .eq("company_id", context.companyId)
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: `Falha ao buscar NF-es: ${error.message}` }, { status: 400 });
    }

    const rows = z.array(InboundZipRowSchema).parse(data ?? []);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma NF-e encontrada para a seleção informada." }, { status: 404 });
    }

    const hasAnyXml = rows.some((row) => Boolean(row.xml_base64));
    if (!hasAnyXml) {
      return NextResponse.json({ error: "Nenhum XML disponível para as NF-es selecionadas." }, { status: 404 });
    }

    const rowById = new Map(rows.map((row) => [row.id, row]));
    const archive = archiver("zip", { zlib: { level: 9 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    archive.on("error", (archiveError: Error) => {
      passThrough.destroy(archiveError);
    });

    void (async () => {
      for (const id of ids) {
        const row = rowById.get(id);
        if (!row) {
          archive.append(
            Buffer.from(`Documento ${id} não encontrado para a empresa atual.`, "utf-8"),
            { name: `ERRO_${sanitizeFileNamePart(id)}.txt` },
          );
          continue;
        }

        if (!row.xml_base64) {
          archive.append(
            Buffer.from(`XML não disponível para a NF-e ${row.chnfe ?? row.nsu}.`, "utf-8"),
            { name: `SEM_XML_${sanitizeFileNamePart(row.chnfe ?? row.nsu)}.txt` },
          );
          continue;
        }

        const xml = decodeInboundXml({
          xmlBase64: row.xml_base64,
          xmlIsGz: row.xml_is_gz,
        });

        const fileId = sanitizeFileNamePart(row.chnfe ?? row.nsu);
        archive.append(Buffer.from(xml, "utf-8"), { name: `nfe-entrada-${fileId}.xml` });
      }

      await archive.finalize();
    })();

    const stream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${getZipName()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar ZIP de XML";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
