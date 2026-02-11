export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseServer';
import { normalizeCorrectionText, validateCorrectionText } from '@/lib/fiscal/nfe/correction-letter-rules';

type Payload = {
    emissionId?: string;
    correctionText?: string;
};

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const body = await request.json() as Payload;
        if (!body?.emissionId) {
            return NextResponse.json({ error: 'emissionId é obrigatório' }, { status: 400 });
        }

        const correctionText = normalizeCorrectionText(body.correctionText || '');
        const validation = validateCorrectionText(correctionText);
        if (!validation.valid) {
            return NextResponse.json({ error: validation.message }, { status: 400 });
        }

        const admin = createAdminClient();
        const { data: emission, error: emissionError } = await admin
            .from('nfe_emissions')
            .select('id, company_id, sales_document_id, access_key, status')
            .eq('id', body.emissionId)
            .maybeSingle();

        if (emissionError || !emission) {
            return NextResponse.json({ error: 'NF-e não encontrada.' }, { status: 404 });
        }

        if (emission.status !== 'authorized') {
            return NextResponse.json({ error: 'Somente NF-e autorizada pode receber carta de correção.' }, { status: 400 });
        }

        const { data: membership } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('auth_user_id', user.id)
            .eq('company_id', emission.company_id)
            .maybeSingle();

        if (!membership) {
            return NextResponse.json({ error: 'Sem permissão para esta empresa.' }, { status: 403 });
        }

        const { data: latestSequence } = await admin
            .from('nfe_correction_letters')
            .select('sequence')
            .eq('company_id', emission.company_id)
            .eq('access_key', emission.access_key)
            .order('sequence', { ascending: false })
            .limit(1)
            .maybeSingle();

        const nextSequence = (latestSequence?.sequence || 0) + 1;

        const { data: letter, error: letterError } = await admin
            .from('nfe_correction_letters')
            .insert({
                company_id: emission.company_id,
                nfe_emission_id: emission.id,
                sales_document_id: emission.sales_document_id,
                access_key: emission.access_key,
                sequence: nextSequence,
                correction_text: correctionText,
                status: 'pending',
                created_by: user.id,
            })
            .select('id, sequence')
            .single();

        if (letterError || !letter) {
            return NextResponse.json({ error: letterError?.message || 'Falha ao criar carta de correção.' }, { status: 500 });
        }

        const { data: job, error: jobError } = await admin
            .from('jobs_queue')
            .insert({
                job_type: 'NFE_CCE',
                payload: { correctionLetterId: letter.id, companyId: emission.company_id },
                status: 'pending',
            })
            .select('id')
            .single();

        if (jobError || !job) {
            await admin
                .from('nfe_correction_letters')
                .update({
                    status: 'failed',
                    x_motivo: 'Falha ao enfileirar processamento da CC-e.',
                })
                .eq('id', letter.id);

            return NextResponse.json({ error: jobError?.message || 'Falha ao enfileirar carta de correção.' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            correctionLetterId: letter.id,
            sequence: letter.sequence,
            jobId: job.id,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Erro interno ao solicitar carta de correção.' },
            { status: 500 }
        );
    }
}
