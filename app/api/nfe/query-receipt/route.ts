export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseServer';
import { consultarRecibo } from '@/lib/nfe/sefaz/services/retAutorizacao';
import { upsertNfeEmission, buildNfeProc } from '@/lib/nfe/sefaz/services/persistence';
import { loadCompanyCertificate } from '@/lib/nfe/sefaz/services/certificateLoader';
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { NfeSefazError } from "@/lib/nfe/sefaz/errors";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";

export async function POST(request: NextRequest) {
    try {
        const limitConfig = process.env.NODE_ENV === 'production'
            ? { limit: 20, windowMs: 60_000 }
            : { limit: 200, windowMs: 60_000 };

        const limit = rateLimit(request, { key: "nfe-query-receipt", ...limitConfig });
        if (!limit.ok) {
            return errorResponse("Too many requests", 429, "RATE_LIMIT");
        }

        // 1. Resolve auth + company server-side (never trust companyId from client)
        let ctx: Awaited<ReturnType<typeof resolveCompanyContext>>;
        try {
            ctx = await resolveCompanyContext();
        } catch {
            return errorResponse("Não autenticado", 401, "UNAUTHORIZED");
        }

        // 2. Parse request
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return errorResponse("JSON inválido", 400, "BAD_JSON");
        }

        const { accessKey } = (body || {}) as { accessKey?: string };

        if (!accessKey) {
            return errorResponse("accessKey obrigatório", 400, "INVALID_PAYLOAD");
        }

        const companyId = ctx.companyId;
        const supabaseAdmin = createAdminClient();


        // 4. Get emission record (if exists)
        const { data: emission } = await supabaseAdmin
            .from('nfe_emissions')
            .select('*')
            .eq('company_id', companyId)
            .eq('access_key', accessKey)
            .maybeSingle(); // Use maybeSingle to not error on 404

        // 5. Load certificate
        // Force clear cache for debugging/recovery
        const { clearCertificateCache } = await import('@/lib/nfe/sefaz/services/certificateLoader');
        clearCertificateCache(companyId);

        const certConfig = await loadCompanyCertificate(companyId);

        let result: any;
        let method = 'receipt';

        // 6. Decide Query Method
        if (emission?.n_recibo) {
            // Standard Flow: We have a receipt number
            method = 'receipt';
            result = await consultarRecibo(emission.n_recibo, {
                uf: emission.uf || 'SP',
                tpAmb: emission.tp_amb || '2',
                xmlNfeAssinado: '',
                idLote: ''
            }, certConfig, {
                debug: process.env.NFE_WS_DEBUG === '1'
            });

        } else {
            // Fallback Flow: Query by Access Key (Protocol)
            method = 'protocol';

            // Dynamic import to avoid circular dep if any (optional, but safe)
            const { consultarProtocolo } = await import('@/lib/nfe/sefaz/services/consultarProtocolo');

            result = await consultarProtocolo(accessKey, {
                uf: emission?.uf || 'SP',
                tpAmb: emission?.tp_amb || '2'
            }, certConfig, {
                debug: process.env.NFE_WS_DEBUG === '1'
            });
        }

        // 7. Update emission with result
        const status = result.cStat === '100' || result.cStat === '104' || result.cStat === '150' ? 'authorized' :
            result.cStat === '101' || result.cStat === '151' || result.cStat === '155' ? 'cancelled' : // Some cancellation statuses
                result.cStat === '105' ? 'processing' :
                    result.cStat.startsWith('1') ? 'denied' : 'rejected';

        const updates: any = {
            status,
            c_stat: result.cStat,
            x_motivo: result.xMotivo
        };

        let xmlNfeProc = emission?.xml_nfe_proc;

        if (result.protNFeXml) {
            // If we have the protocol, and we have the signed XML, we can build the proc
            // If we don't have signed XML (data loss), we can't build full proc yet, 
            // but we can save the protocol.

            if (emission?.xml_signed) {
                updates.xml_nfe_proc = buildNfeProc(emission.xml_signed, result.protNFeXml);
                xmlNfeProc = updates.xml_nfe_proc;
            }

            // Extract nProt
            const nProtMatch = result.protNFeXml.match(/<nProt>(\d+)<\/nProt>/);
            if (nProtMatch) {
                updates.n_prot = nProtMatch[1];
            }

            // Extract dhRecbto
            const dhRecbtoMatch = result.protNFeXml.match(/<dhRecbto>(.*?)<\/dhRecbto>/);
            if (dhRecbtoMatch) {
                updates.dh_recbto = dhRecbtoMatch[1];
            }
        }

        // Upsert (Create if missing)
        await upsertNfeEmission({
            company_id: companyId,
            access_key: accessKey,
            numero: emission?.numero || '0', // Fallback if missing
            serie: emission?.serie || '0', // Fallback if missing
            tp_amb: emission?.tp_amb || '2',
            xml_signed: emission?.xml_signed || '', // Preserve or empty
            ...updates
        });

        const exposeXml = process.env.NODE_ENV !== 'production' || process.env.EXPOSE_NFE_XML === 'true';
        return NextResponse.json({
            success: status === 'authorized',
            status,
            cStat: result.cStat,
            xMotivo: result.xMotivo,
            method,
            ...(exposeXml ? { xmlNfeProc: updates.xml_nfe_proc } : {})
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[QueryReceipt] Error', {
            message,
            code: (error as { code?: unknown })?.code
        });

        if (error instanceof NfeSefazError) {
            const safeDetails = {
                code: error.code,
                hint: (error.details as { hint?: unknown })?.hint,
                status: (error.details as { status?: unknown })?.status
            };
            return errorResponse("Erro ao consultar SEFAZ", 500, "SEFAZ_ERROR", safeDetails);
        }

        return errorResponse(message || "Erro ao consultar recibo", 500, "INTERNAL_ERROR");
    }
}
