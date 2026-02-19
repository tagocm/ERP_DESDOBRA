import { NextRequest, NextResponse } from 'next/server';
import { generateDanfePdf } from '@/lib/danfe/pdfService';
import { logger } from "@/lib/logger";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api/response";
import { resolveNfeArtifactsById } from "@/lib/fiscal/nfe/artifacts";
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

export const maxDuration = 60; // Allow sufficient time for Chromium launch

export async function POST(req: NextRequest) {
    try {
        const limit = rateLimit(req, { key: "nfe-danfe", limit: 20, windowMs: 60_000 });
        if (!limit.ok) {
            return errorResponse("Too many requests", 429, "RATE_LIMIT");
        }

        const ctx = await resolveCompanyContext();
        const ctxCompanyId = ctx.companyId;
        const supabase = ctx.supabase;
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return errorResponse("JSON inválido", 400, "BAD_JSON");
        }

        const schema = z.object({
            xml: z.string().min(1).optional(),
            id: z.string().min(1).optional()
        }).refine((data) => data.xml || data.id, { message: 'XML ou ID é obrigatório' });

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Payload inválido", 400, "INVALID_PAYLOAD");
        }

        let { xml, id } = parsed.data;

        // Declare companyId at top level for proper scope
        let companyId: string | undefined = ctxCompanyId;

        if (!xml && id) {
            logger.info('[DANFE API] Fetching NFe by ID:', id);
            try {
                const artifacts = await resolveNfeArtifactsById(supabase, ctxCompanyId, id);
                xml = artifacts.xml;
                companyId = artifacts.companyId || ctxCompanyId;
            } catch (resolveError: any) {
                logger.error('[DANFE API] resolve artifacts error:', resolveError);
                return errorResponse(
                    "NF-e record not found",
                    404,
                    "NOT_FOUND",
                    { details: resolveError?.message || 'No XML available for NF-e', id }
                );
            }
        }

        if (!xml) {
            return errorResponse("XML não encontrado", 404, "NOT_FOUND");
        }
        const xmlString = xml;

        // Generate PDF with better error handling
        try {
            logger.info('[DANFE API] Generating PDF with companyId:', companyId);
            const adminSupabase = createAdminClient();
            const { data: settings } = await adminSupabase
                .from('company_settings')
                .select('legal_name,trade_name,cnpj,ie,address_street,address_number,address_neighborhood,address_city,address_state,address_zip')
                .eq('company_id', companyId)
                .maybeSingle();
            const logoUrl =
                await resolveCompanyLogoDataUri(adminSupabase, companyId) ||
                await resolveCompanyLogoUrl(adminSupabase, companyId);
            const emitterOverride = buildEmitterOverride(settings);

            const pdfBuffer = await generateDanfePdf(xmlString, companyId, logoUrl, emitterOverride);

            // Cast to any because NextResponse supports Buffer in Node.js runtime even if types strictly say BodyInit
            return new NextResponse(pdfBuffer as any, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'inline; filename="danfe.pdf"',
                },
            });
        } catch (pdfError: any) {
            logger.error('[DANFE API] PDF Generation Error:', pdfError.message);

            // Try to parse and show structure for debugging
            const debugInfo: any = { message: pdfError.message };
            try {
                const { XMLParser } = await import('fast-xml-parser');
                const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
                const parsed = parser.parse(xmlString);
                debugInfo.xmlStructure = {
                    rootKeys: Object.keys(parsed),
                    hasNfeProc: 'nfeProc' in parsed,
                    hasNFe: 'NFe' in parsed,
                    hasEnviNFe: 'enviNFe' in parsed
                };
            } catch {
                debugInfo.xmlStructure = 'Could not parse XML for debug';
            }

            return errorResponse(
                "Failed to generate DANFE",
                500,
                "DANFE_ERROR",
                {
                    details: pdfError.message,
                    debug: debugInfo
                }
            );
        }
    } catch (error: any) {
        logger.error('DANFE Generation Error:', error);
        return errorResponse("Failed to generate DANFE", 500, "INTERNAL_ERROR", { details: error.message });
    }
}
