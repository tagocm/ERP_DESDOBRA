export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { emitirNfeHomolog } from '@/lib/nfe/sefaz/services/emitir';
import { checkIdempotency, upsertNfeEmission, buildNfeProc } from '@/lib/nfe/sefaz/services/persistence';
import { loadCompanyCertificate } from '@/lib/nfe/sefaz/services/certificateLoader';
import { NfeDraft } from '@/lib/nfe/domain/types';

export async function POST(request: NextRequest) {
    try {
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
        const { draft, companyId, tpAmb = '2' } = await request.json() as {
            draft: NfeDraft;
            companyId: string;
            tpAmb?: '1' | '2';
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
            return NextResponse.json(
                { error: `Erro ao carregar certificado: ${error.message}` },
                { status: 400 }
            );
        }

        // 6. Generate idLote
        const idLote = Date.now().toString().slice(-15);

        // 7. Create initial emission record
        await upsertNfeEmission({
            company_id: companyId,
            access_key: accessKey,
            numero: draft.ide.nNF,
            serie: draft.ide.serie,
            status: 'draft',
            tp_amb: tpAmb,
            uf: 'SP',
            id_lote: idLote,
            xml_signed: '', // Will be updated after signing
            attempts: 0
        });

        // 8. Emit NF-e with persistence options
        const result = await emitirNfeHomolog(draft, certConfig, idLote, {
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
            access_key: accessKey,
            numero: draft.ide.nNF,
            serie: draft.ide.serie,
            tp_amb: tpAmb,
            ...updates
        });

        return NextResponse.json({
            success: result.success,
            cStat: result.cStat,
            xMotivo: result.xMotivo,
            logs: result.logs,
            xmlNfeProc: updates.xml_nfe_proc
        });

    } catch (error: any) {
        console.error('NF-e authorization error:', error);
        return NextResponse.json(
            { error: error.message || 'Erro ao autorizar NF-e' },
            { status: 500 }
        );
    }
}
