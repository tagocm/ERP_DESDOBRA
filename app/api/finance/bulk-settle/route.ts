
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { installmentIds, date, accountId } = await request.json();

    if (!installmentIds || !Array.isArray(installmentIds) || installmentIds.length === 0) {
        return NextResponse.json({ error: 'Nenhum lançamento selecionado' }, { status: 400 });
    }

    if (!date || !accountId) {
        return NextResponse.json({ error: 'Data e Conta são obrigatórios' }, { status: 400 });
    }

    let successCount = 0;
    const errors = [];

    const isUuid = (value: unknown) =>
        typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    // Fetch companies the current user belongs to once (avoid per-row membership queries)
    const { data: memberships, error: membershipsError } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('auth_user_id', user.id);

    if (membershipsError) {
        return NextResponse.json({ error: 'Erro ao validar empresa do usuário' }, { status: 500 });
    }

    const allowedCompanyIds = new Set((memberships || []).map((m: any) => m.company_id));

    // Process each installment
    // Note: Ideally this should be a stored procedure for atomicity
    for (const id of installmentIds) {
        try {
            // 1. Fetch Installment to get current open amount
            const { data: inst, error: fetchError } = await supabase
                .from('ar_installments')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !inst) {
                errors.push({ id, reason: 'Não encontrado' });
                continue;
            }

            if (inst.status === 'PAID') {
                errors.push({ id, reason: 'Já baixado' });
                continue;
            }

            if (inst.amount_open <= 0) {
                errors.push({ id, reason: 'Saldo zero' });
                continue;
            }

            const installmentCompanyId = inst.company_id;
            if (!installmentCompanyId || !allowedCompanyIds.has(installmentCompanyId)) {
                errors.push({ id, reason: 'Sem permissão' });
                continue;
            }

            const amountToPay = inst.amount_open; // Full settle

            // 2. Create Payment
            const { data: payment, error: payError } = await supabase
                .from('ar_payments')
                .insert({
                    company_id: installmentCompanyId,
                    created_by: user.id,
                    amount: amountToPay,
                    method: inst.payment_method || 'OUTROS', // Inherit method or default
                    paid_at: date, // User selected date (can be timestamp?)
                    notes: `Baixa em Lote - ${new Date().toLocaleDateString('pt-BR')}`,
                    // accountId is kept for UI contract; persistence can be added when schema supports it
                    reference: accountId
                })
                .select()
                .single();

            if (payError) {
                console.error('Payment Error', payError);
                errors.push({ id, reason: 'Erro ao criar pagamento' });
                continue;
            }

            // 3. Create Allocation
            const { error: allocError } = await supabase
                .from('ar_payment_allocations')
                .insert({
                    payment_id: payment.id,
                    installment_id: inst.id,
                    amount_allocated: amountToPay
                });

            if (allocError) {
                console.error('Allocation Error', allocError);
                // Rollback payment? (Hard without transaction).
                // Log critical error.
                errors.push({ id, reason: 'Erro ao vincular pagamento' });
                continue;
            }

            // 4. Update Installment Status (Trigger usually handles balance, but let's be explicit if needed or rely on triggers)
            // Assuming triggers handle `amount_paid` and `amount_open` updates on allocation insert.
            // But usually we might need to force status update if trigger is not robust.
            // Let's assume triggers exist (based on `migration.sql` work previously).
            // Check triggers... previous migration added triggers for `ar_titles`. 
            // `ar_installments` updates usually happen via trigger on `ar_payment_allocations`?
            // If not sure, explicit update is safer.

            const { error: updateError } = await supabase
                .from('ar_installments')
                .update({
                    status: 'PAID',
                    amount_paid: (inst.amount_paid || 0) + amountToPay,
                    amount_open: 0,
                    ...(isUuid(accountId) ? { financial_account_id: accountId } : {})
                })
                .eq('id', inst.id);

            if (updateError) {
                console.error('Update Error', updateError);
                errors.push({ id, reason: 'Erro ao atualizar status' });
                continue;
            }

            successCount++;

        } catch (e: any) {
            errors.push({ id, reason: e.message });
        }
    }

    return NextResponse.json({
        success: true,
        count: successCount,
        errors: errors,
        message: `${successCount} baixas realizadas com sucesso.`
    });
}
