export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseServer';
import { consultarRecibo } from '@/lib/nfe/sefaz/services/retAutorizacao';
import { upsertNfeEmission, buildNfeProc } from '@/lib/nfe/sefaz/services/persistence';
import { loadCompanyCertificate } from '@/lib/nfe/sefaz/services/certificateLoader';

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate
        const supabaseUser = await createClient();
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

        if (authError || !user) {
            console.error('[QueryReceipt] Auth failed:', authError);
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        console.log('[QueryReceipt] User authenticated:', user.id);

        // 2. Parse request
        const { accessKey, companyId } = await request.json();

        if (!accessKey || !companyId) {
            return NextResponse.json({ error: 'accessKey e companyId obrigatórios' }, { status: 400 });
        }

        // 3. Verify membership
        const supabaseAdmin = createAdminClient();

        console.log(`[QueryReceipt] Checking membership for User: ${user.id}, Company: ${companyId}`);
        // const supabaseAdmin = createAdminClient(); // Moved up
        const { data: membership, error: membershipError } = await supabaseAdmin
            .from('company_members')
            .select('company_id')
            .eq('company_id', companyId)
            .eq('auth_user_id', user.id)
            .single();

        if (membershipError || !membership) {
            console.error('[QueryReceipt] Membership check failed:', membershipError);
            return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
        }


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
            console.log(`[QueryReceipt] Querying by Receipt: ${emission.n_recibo}`);
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
            console.log(`[QueryReceipt] Fallback: Querying by Access Key: ${accessKey}`);
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

        return NextResponse.json({
            success: status === 'authorized',
            status,
            cStat: result.cStat,
            xMotivo: result.xMotivo,
            xmlNfeProc: updates.xml_nfe_proc
        });

    } catch (error: any) {
        console.error('Query receipt error:', error);

        // Return full diagnostic details if available
        if (error.details) {
            return NextResponse.json(error.details, { status: 500 });
        }

        return NextResponse.json(
            { error: error.message || 'Erro ao consultar recibo' },
            { status: 500 }
        );
    }
}
