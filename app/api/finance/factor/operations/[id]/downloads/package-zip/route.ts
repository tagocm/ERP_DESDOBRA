export const runtime = "nodejs";
export const maxDuration = 120;

import archiver from "archiver";
import { PassThrough } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/response";
import { handleFactorApiError, resolveFactorService } from "@/app/api/finance/factor/_server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDanfePdf } from "@/lib/danfe/pdfService";
import { resolveCompanyLogoDataUri, resolveCompanyLogoUrl } from "@/lib/fiscal/nfe/logo-resolver";
import type { DanfeEmitterOverride } from "@/lib/danfe/pdfService";

const companySettingsSchema = z.object({
    legal_name: z.string().nullish(),
    trade_name: z.string().nullish(),
    cnpj: z.string().nullish(),
    ie: z.string().nullish(),
    address_street: z.string().nullish(),
    address_number: z.string().nullish(),
    address_neighborhood: z.string().nullish(),
    address_city: z.string().nullish(),
    address_state: z.string().nullish(),
    address_zip: z.string().nullish(),
});

type CompanySettingsRow = z.infer<typeof companySettingsSchema>;

function buildEmitterOverride(settings: CompanySettingsRow | null): DanfeEmitterOverride | undefined {
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

function sanitizeNamePart(value: string): string {
    return value.trim().replace(/[^\w\-]+/g, "_");
}

const paramsSchema = z.object({
    id: z.string().uuid(),
});

const querySchema = z.object({
    bundle: z.enum(["xml", "danfe", "all"]).default("all"),
});

type NfeArtifactRow = {
    id: string;
    sales_document_id: string | null;
    numero: string;
    serie: string;
    status: string;
    xml_nfe_proc: string | null;
    xml_signed: string;
};

const nfeArtifactSchema = z.object({
    id: z.string().uuid(),
    sales_document_id: z.string().uuid().nullable(),
    numero: z.string(),
    serie: z.string(),
    status: z.string(),
    xml_nfe_proc: z.string().nullable(),
    xml_signed: z.string(),
});

function streamToBuffer(stream: PassThrough): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer | string) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        stream.on("error", reject);
        stream.on("end", () => {
            resolve(Buffer.concat(chunks));
        });
    });
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const { context: factorContext, service } = await resolveFactorService();
        const params = paramsSchema.safeParse(await context.params);
        if (!params.success) {
            return errorResponse("Operação inválida", 400, "INVALID_OPERATION_ID", params.error.flatten());
        }

        const query = querySchema.safeParse({
            bundle: request.nextUrl.searchParams.get("bundle") ?? undefined,
        });
        if (!query.success) {
            return errorResponse("Parâmetro inválido", 400, "INVALID_QUERY", query.error.flatten());
        }

        const detail = await service.getOperationDetail(params.data.id);
        const salesDocumentIds = Array.from(new Set(
            detail.items
                .map((item) => item.sales_document_id)
                .filter((value): value is string => Boolean(value)),
        ));

        const adminSupabase = createAdminClient();
        let artifacts: NfeArtifactRow[] = [];
        if (salesDocumentIds.length > 0) {
            const { data, error } = await adminSupabase
                .from("nfe_emissions")
                .select("id,sales_document_id,numero,serie,status,xml_nfe_proc,xml_signed")
                .eq("company_id", factorContext.companyId)
                .in("sales_document_id", salesDocumentIds)
                .eq("status", "authorized");

            if (error) {
                return errorResponse(`Erro ao buscar XMLs vinculados: ${error.message}`, 500, "NFE_LOOKUP_ERROR");
            }

            artifacts = z.array(nfeArtifactSchema).parse(data ?? []);
        }

        const { data: settingsData } = await adminSupabase
            .from("company_settings")
            .select("legal_name,trade_name,cnpj,ie,address_street,address_number,address_neighborhood,address_city,address_state,address_zip")
            .eq("company_id", factorContext.companyId)
            .maybeSingle();
        const settings = settingsData ? companySettingsSchema.parse(settingsData) : null;
        const emitterOverride = buildEmitterOverride(settings);

        const logoUri = await resolveCompanyLogoDataUri(adminSupabase, factorContext.companyId)
            || await resolveCompanyLogoUrl(adminSupabase, factorContext.companyId);

        const archive = archiver("zip", { zlib: { level: 9 } });
        const passThrough = new PassThrough();
        const zipBufferPromise = streamToBuffer(passThrough);
        archive.pipe(passThrough);

        archive.append(
            Buffer.from(JSON.stringify(detail, null, 2), "utf-8"),
            { name: `operacao_${sanitizeNamePart(String(detail.operation.operation_number))}_snapshot.json` },
        );

        for (const emission of artifacts) {
            const xml = emission.xml_nfe_proc || emission.xml_signed || "";
            if (!xml.trim()) continue;

            const baseName = `NFe_${sanitizeNamePart(emission.numero)}_S${sanitizeNamePart(emission.serie)}`;
            if (query.data.bundle === "xml" || query.data.bundle === "all") {
                archive.append(Buffer.from(xml, "utf-8"), { name: `${baseName}.xml` });
            }

            if (query.data.bundle === "danfe" || query.data.bundle === "all") {
                const pdf = await generateDanfePdf(xml, factorContext.companyId, logoUri, emitterOverride);
                archive.append(Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf), { name: `${baseName}.pdf` });
            }
        }

        if (artifacts.length === 0) {
            archive.append(
                Buffer.from("Nenhuma NF-e autorizada encontrada para os pedidos desta operação.", "utf-8"),
                { name: "README.txt" },
            );
        }

        await archive.finalize();
        const zipBuffer = await zipBufferPromise;
        const zipBytes = Uint8Array.from(zipBuffer);

        return new NextResponse(zipBytes, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="factor_operacao_${detail.operation.operation_number}.zip"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error: unknown) {
        return handleFactorApiError(error);
    }
}
