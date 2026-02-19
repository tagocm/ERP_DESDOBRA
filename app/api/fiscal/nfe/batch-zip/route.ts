export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api/response";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { resolveNfeArtifactsById } from "@/lib/fiscal/nfe/artifacts";
import { generateDanfePdf } from "@/lib/danfe/pdfService";
import { resolveCompanyLogoDataUri, resolveCompanyLogoUrl } from "@/lib/fiscal/nfe/logo-resolver";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DanfeEmitterOverride } from "@/lib/danfe/pdfService";

function buildEmitterOverride(settings: any): DanfeEmitterOverride | undefined {
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

function sanitizeFileNamePart(value: string | null | undefined, fallback: string): string {
    const raw = (value || fallback).trim();
    return raw.replace(/[^\w\-]+/g, "_");
}

export async function POST(req: NextRequest) {
    try {
        const limit = rateLimit(req, { key: "nfe-batch-zip", limit: 10, windowMs: 60_000 });
        if (!limit.ok) {
            return errorResponse("Too many requests", 429, "RATE_LIMIT");
        }

        const ctx = await resolveCompanyContext();
        const supabase = ctx.supabase;
        const companyId = ctx.companyId;
        const adminSupabase = createAdminClient();

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return errorResponse("JSON inválido", 400, "BAD_JSON");
        }

        const schema = z.object({
            ids: z.array(z.string().min(1)).min(1).max(100),
            bundle: z.enum(["xml", "danfe"]).default("danfe"),
        });

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Payload inválido", 400, "INVALID_PAYLOAD");
        }

        const ids = Array.from(new Set(parsed.data.ids));
        const bundle = parsed.data.bundle;

        const logoUrlCache = new Map<string, string | undefined>();
        const emitterOverrideCache = new Map<string, DanfeEmitterOverride | undefined>();
        const resolveLogoUrl = async (targetCompanyId: string): Promise<string | undefined> => {
            if (logoUrlCache.has(targetCompanyId)) {
                return logoUrlCache.get(targetCompanyId);
            }

            const logoUrl =
                await resolveCompanyLogoDataUri(adminSupabase, targetCompanyId) ||
                await resolveCompanyLogoUrl(adminSupabase, targetCompanyId);

            logoUrlCache.set(targetCompanyId, logoUrl);
            return logoUrl;
        };
        const resolveEmitterOverride = async (targetCompanyId: string): Promise<DanfeEmitterOverride | undefined> => {
            if (emitterOverrideCache.has(targetCompanyId)) {
                return emitterOverrideCache.get(targetCompanyId);
            }
            const { data: settings } = await adminSupabase
                .from('company_settings')
                .select('legal_name,trade_name,cnpj,ie,address_street,address_number,address_neighborhood,address_city,address_state,address_zip')
                .eq('company_id', targetCompanyId)
                .maybeSingle();
            const emitterOverride = buildEmitterOverride(settings);
            emitterOverrideCache.set(targetCompanyId, emitterOverride);
            return emitterOverride;
        };

        const archive = archiver("zip", { zlib: { level: 9 } });
        const passThrough = new PassThrough();
        archive.pipe(passThrough);

        archive.on("warning", (warning) => {
            logger.warn("[NFE Batch ZIP] warning", { message: warning.message });
        });
        archive.on("error", (error) => {
            logger.error("[NFE Batch ZIP] archive error", { message: error.message });
            passThrough.destroy(error);
        });

        void (async () => {
            for (const id of ids) {
                try {
                    const artifacts = await resolveNfeArtifactsById(supabase, companyId, id);
                    const nfNumber = sanitizeFileNamePart(artifacts.nfeNumber, id);
                    const nfSeries = sanitizeFileNamePart(artifacts.nfeSeries, "1");
                    const baseName = `NFe_${nfNumber}_S${nfSeries}_${sanitizeFileNamePart(artifacts.documentNumber, "SEM_PEDIDO")}`;

                    if (bundle === "xml") {
                        archive.append(Buffer.from(artifacts.xml, "utf-8"), { name: `${baseName}.xml` });
                    } else {
                        const targetCompanyId = artifacts.companyId || companyId;
                        const logoUrl = await resolveLogoUrl(targetCompanyId);
                        const emitterOverride = await resolveEmitterOverride(targetCompanyId);
                        const pdfBuffer = await generateDanfePdf(artifacts.xml, targetCompanyId, logoUrl, emitterOverride);
                        archive.append(Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer), { name: `${baseName}.pdf` });
                    }

                    const { data: correctionLetters, error: correctionError } = await supabase
                        .from("nfe_correction_letters")
                        .select("sequence,status,response_xml,request_xml")
                        .eq("company_id", artifacts.companyId || companyId)
                        .eq("nfe_emission_id", id)
                        .eq("status", "authorized")
                        .order("sequence", { ascending: true });

                    if (correctionError) {
                        logger.warn("[NFE Batch ZIP] correction-letter lookup failed", { id, message: correctionError.message });
                    } else {
                        for (const letter of correctionLetters || []) {
                            const xmlSource = (letter.response_xml || letter.request_xml || "").trim();
                            if (!xmlSource) continue;
                            const sequence = String(letter.sequence || 1).padStart(2, "0");
                            archive.append(Buffer.from(xmlSource, "utf-8"), {
                                name: `${baseName}_CCE_${sequence}.xml`,
                            });
                        }
                    }
                } catch (error: any) {
                    logger.error("[NFE Batch ZIP] failed item", { id, message: error?.message });
                    archive.append(
                        Buffer.from(`Falha ao processar NF-e ${id}: ${error?.message || "erro desconhecido"}`, "utf-8"),
                        { name: `ERRO_${sanitizeFileNamePart(id, "UNKNOWN")}.txt` }
                    );
                }
            }

            await archive.finalize();
        })();

        const zipFileName = `${bundle === "xml" ? "xml" : "danfe"}_lote_${new Date().toISOString().slice(0, 10)}.zip`;
        return new NextResponse(Readable.toWeb(passThrough) as any, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${zipFileName}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error: any) {
        logger.error("[NFE Batch ZIP] fatal", { message: error?.message });
        return errorResponse("Falha ao gerar ZIP do lote", 500, "INTERNAL_ERROR", {
            details: error?.message || "erro desconhecido",
        });
    }
}
