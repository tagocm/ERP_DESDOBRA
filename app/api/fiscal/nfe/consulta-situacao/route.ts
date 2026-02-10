export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabaseServer';
import { consultarRecibo } from '@/lib/nfe/sefaz/services/retAutorizacao';
import { upsertNfeEmission, buildNfeProc } from '@/lib/nfe/sefaz/services/persistence';
import { loadCompanyCertificate } from '@/lib/nfe/sefaz/services/certificateLoader';
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { NfeSefazError } from "@/lib/nfe/sefaz/errors";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { syncSalesDocumentFiscalStatus } from "@/lib/fiscal/nfe/sync-sales-document-fiscal-status";

function mapLegacyStatusForUi(status: string): 'authorized' | 'processing' | 'error' {
    if (status === 'authorized') return 'authorized';
    if (status === 'processing') return 'processing';
    return 'error';
}

export async function POST(request: NextRequest) {
    try {
        const limitConfig = process.env.NODE_ENV === 'production'
            ? { limit: 20, windowMs: 60_000 }
            : { limit: 200, windowMs: 60_000 };
        const limit = rateLimit(request, { key: "nfe-consulta-situacao", ...limitConfig });
        if (!limit.ok) {
            return errorResponse("Too many requests", 429, "RATE_LIMIT");
        }

        let ctx: Awaited<ReturnType<typeof resolveCompanyContext>>;
        try {
            ctx = await resolveCompanyContext();
        } catch {
            return errorResponse("Não autenticado", 401, "UNAUTHORIZED");
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return errorResponse("JSON inválido", 400, "BAD_JSON");
        }

        const { id } = (body || {}) as { id?: string };
        if (!id) {
            return errorResponse("id obrigatório", 400, "INVALID_PAYLOAD");
        }

        const companyId = ctx.companyId;
        const supabaseAdmin = createAdminClient();

        const { data: emission } = await supabaseAdmin
            .from('nfe_emissions')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', id)
            .maybeSingle();

        let legacyNfe: {
            id: string;
            document_id: string | null;
            nfe_key: string | null;
            nfe_number: number | null;
            nfe_series: number | null;
            status: string | null;
        } | null = null;

        if (!emission) {
            const { data: legacy } = await supabaseAdmin
                .from('sales_document_nfes')
                .select('id, document_id, nfe_key, nfe_number, nfe_series, status')
                .eq('company_id', companyId)
                .eq('id', id)
                .maybeSingle();
            legacyNfe = legacy || null;
        }

        if (!emission && !legacyNfe) {
            return errorResponse("NF-e não encontrada", 404, "NOT_FOUND");
        }

        const accessKey = emission?.access_key || legacyNfe?.nfe_key;
        if (!accessKey) {
            return errorResponse("Chave de acesso não encontrada na NF-e", 400, "INVALID_STATE");
        }

        const certConfig = await loadCompanyCertificate(companyId);

        let result: any;
        let method = 'protocol';

        if (emission?.n_recibo) {
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
            const { consultarProtocolo } = await import('@/lib/nfe/sefaz/services/consultarProtocolo');
            result = await consultarProtocolo(accessKey, {
                uf: emission?.uf || 'SP',
                tpAmb: emission?.tp_amb || '2'
            }, certConfig, {
                debug: process.env.NFE_WS_DEBUG === '1'
            });
        }

        const status = result.cStat === '100' || result.cStat === '104' || result.cStat === '150' ? 'authorized' :
            result.cStat === '101' || result.cStat === '151' || result.cStat === '155' ? 'cancelled' :
                result.cStat === '105' ? 'processing' :
                    result.cStat.startsWith('1') ? 'denied' : 'rejected';

        const updates: any = {
            status,
            c_stat: result.cStat,
            x_motivo: result.xMotivo
        };

        if (result.protNFeXml) {
            if (emission?.xml_signed) {
                updates.xml_nfe_proc = buildNfeProc(emission.xml_signed, result.protNFeXml);
            }

            const nProtMatch = result.protNFeXml.match(/<nProt>(\d+)<\/nProt>/);
            if (nProtMatch) updates.n_prot = nProtMatch[1];

            const dhRecbtoMatch = result.protNFeXml.match(/<dhRecbto>(.*?)<\/dhRecbto>/);
            if (dhRecbtoMatch) updates.dh_recbto = dhRecbtoMatch[1];
        }

        const safeNumero = emission?.numero || (legacyNfe?.nfe_number ? String(legacyNfe.nfe_number) : null);
        const safeSerie = emission?.serie || (legacyNfe?.nfe_series ? String(legacyNfe.nfe_series) : null);

        if (!safeNumero || !safeSerie) {
            return errorResponse("Dados fiscais incompletos (numero/série)", 409, "INVALID_STATE");
        }

        await upsertNfeEmission({
            company_id: companyId,
            sales_document_id: emission?.sales_document_id || legacyNfe?.document_id || undefined,
            access_key: accessKey,
            numero: safeNumero,
            serie: safeSerie,
            tp_amb: emission?.tp_amb || '2',
            uf: emission?.uf || 'SP',
            xml_signed: emission?.xml_signed || '',
            ...updates
        });

        await syncSalesDocumentFiscalStatus(
            supabaseAdmin,
            emission?.sales_document_id || legacyNfe?.document_id || undefined,
            status as 'processing' | 'authorized' | 'cancelled' | 'denied' | 'rejected' | 'error'
        );

        if (legacyNfe) {
            await supabaseAdmin
                .from('sales_document_nfes')
                .update({
                    status: mapLegacyStatusForUi(status),
                    updated_at: new Date().toISOString()
                })
                .eq('id', legacyNfe.id)
                .eq('company_id', companyId);
        }

        return Response.json({
            success: status === 'authorized',
            status,
            cStat: result.cStat,
            xMotivo: result.xMotivo,
            nProt: updates.n_prot || emission?.n_prot || null,
            dhRecbto: updates.dh_recbto || emission?.dh_recbto || null,
            method
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[fiscal/nfe/consulta-situacao] Error', {
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

        return errorResponse(message || "Erro ao consultar situação", 500, "INTERNAL_ERROR");
    }
}
