export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { emitirNfeHomolog } from '@/lib/nfe/sefaz/services/emitir';
import { checkIdempotency, upsertNfeEmission, buildNfeProc } from '@/lib/nfe/sefaz/services/persistence';
import { loadCompanyCertificate } from '@/lib/nfe/sefaz/services/certificateLoader';
import { NfeDraft } from '@/lib/nfe/domain/types';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabaseServer';
import { syncSalesDocumentFiscalStatus } from '@/lib/fiscal/nfe/sync-sales-document-fiscal-status';

function mapUfFromCUF(cUF?: string): string {
    const ufMap: Record<string, string> = {
        "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
        "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
        "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR",
        "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"
    };
    return ufMap[cUF || ""] || "SP";
}

export async function POST(request: NextRequest) {
    try {
        const limitConfig = process.env.NODE_ENV === 'production'
            ? { limit: 10, windowMs: 60_000 }
            : { limit: 100, windowMs: 60_000 };
        const limit = rateLimit(request, { key: "nfe-authorize", ...limitConfig });
        if (!limit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        // 1. Authenticate user
        const supabaseUser = await createClient();
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autenticado' },
                { status: 401 }
            );
        }

        // 2. Parse request
        const { draft, companyId, tpAmb = '2', salesDocumentId } = await request.json() as {
            draft: NfeDraft;
            companyId: string;
            tpAmb?: '1' | '2';
            salesDocumentId?: string;
        };

        if (!draft || !companyId) {
            return NextResponse.json(
                { error: 'Draft e companyId são obrigatórios' },
                { status: 400 }
            );
        }

        // 3. Verify user is member of company
        const { data: membership, error: membershipError } = await supabaseUser
            .from('company_members')
            .select('company_id')
            .eq('company_id', companyId)
            .eq('auth_user_id', user.id)
            .single();

        if (membershipError || !membership) {
            return NextResponse.json(
                { error: 'Você não tem permissão para acessar esta empresa' },
                { status: 403 }
            );
        }

        // 4. Check idempotency (prevent re-emission)
        const accessKey = draft.ide.chNFe;
        if (!accessKey || accessKey.length !== 44) {
            return NextResponse.json(
                { error: 'Chave de acesso (chNFe) inválida' },
                { status: 400 }
            );
        }

        const existing = await checkIdempotency(accessKey, companyId);
        if (existing) {
            return NextResponse.json({
                success: true,
                message: 'NF-e já autorizada anteriormente',
                emission: existing
            });
        }

        // 5. Load certificate with cache
        let certConfig;
        try {
            certConfig = await loadCompanyCertificate(companyId);
        } catch (error: any) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return NextResponse.json(
                { error: process.env.NODE_ENV === 'production' ? 'Erro ao carregar certificado' : `Erro ao carregar certificado: ${message}` },
                { status: 400 }
            );
        }

        // 6. Generate idLote
        const idLote = Date.now().toString().slice(-15);

        // 7. Create initial emission record
        const draftWithEnv: NfeDraft = {
            ...draft,
            ide: {
                ...draft.ide,
                tpAmb
            }
        };

        await upsertNfeEmission({
            company_id: companyId,
            sales_document_id: salesDocumentId || undefined,
            access_key: accessKey,
            numero: draft.ide.nNF,
            serie: draft.ide.serie,
            status: 'draft',
            tp_amb: tpAmb,
            uf: mapUfFromCUF(draft.ide.cUF),
            id_lote: idLote,
            xml_signed: '', // Will be updated after signing
            attempts: 0
        });

        // 8. Emit NF-e with persistence options
        const result = await emitirNfeHomolog(draftWithEnv, certConfig, idLote, {
            debug: process.env.NFE_WS_DEBUG === '1',
            companyId,
            accessKey
        });

        // 9. Update emission record with final result
        const status = result.success ? 'authorized' :
            (result.cStat === '103' || result.cStat === '105') ? 'processing' :
                (result.cStat.startsWith('1')) ? 'denied' : 'rejected';

        const updates: any = {
            status,
            xml_signed: result.nfeXmlAssinado,
            c_stat: result.cStat,
            x_motivo: result.xMotivo,
            n_recibo: result.nRec
        };

        if (result.success && result.protNFeXml) {
            updates.xml_nfe_proc = buildNfeProc(result.nfeXmlAssinado, result.protNFeXml);
            // Extract protocol number from protNFe XML (naive regex)
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

        await upsertNfeEmission({
            company_id: companyId,
            sales_document_id: salesDocumentId || undefined,
            access_key: accessKey,
            numero: draft.ide.nNF,
            serie: draft.ide.serie,
            tp_amb: tpAmb,
            uf: mapUfFromCUF(draft.ide.cUF),
            ...updates
        });

        if (salesDocumentId) {
            const admin = createAdminClient();
            await syncSalesDocumentFiscalStatus(
                admin,
                salesDocumentId,
                status as 'processing' | 'authorized' | 'cancelled' | 'denied' | 'rejected' | 'error'
            );
        }

        const exposeXml = process.env.NODE_ENV !== 'production' || process.env.EXPOSE_NFE_XML === 'true';
        const exposeLogs = process.env.NODE_ENV !== 'production' || process.env.EXPOSE_NFE_LOGS === 'true';
        return NextResponse.json({
            success: result.success,
            status,
            cStat: result.cStat,
            xMotivo: result.xMotivo,
            ...(exposeLogs ? { logs: result.logs } : {}),
            ...(exposeXml ? { xmlNfeProc: updates.xml_nfe_proc } : {})
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[nfe/authorize] Error', { message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Erro ao autorizar NF-e' : message },
            { status: 500 }
        );
    }
}
