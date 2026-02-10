import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Helper to update balances
async function updateBalances(supabase: any, installmentId: string, titleId: string, diff: number) {
    // diff = newPaid - oldPaid (or simply +amount for add, -amount for remove)
    // Actually, let's just recalculate to be safe? No, recalculating from all payments is safer but more expensive.
    // Let's use diff logic.
    // If we are ADDING payment, diff is positive.
    // If REMOVING, diff is negative.

    // 1. Update Installment
    const { data: inst } = await supabase.from('ar_installments').select('*').eq('id', installmentId).single();
    if (!inst) throw new Error("Parcela não encontrada");

    const newInstPaid = Number(inst.amount_paid) + diff;
    const newInstOpen = Math.max(0, Number(inst.amount_original) - newInstPaid);
    const newInstStatus = newInstOpen < 0.01 ? 'PAID' : 'PARTIAL'; // simplistic status logic

    await supabase.from('ar_installments').update({
        amount_paid: newInstPaid,
        amount_open: newInstOpen,
        status: newInstStatus
    }).eq('id', installmentId);


    // 2. Update Title
    const { data: title } = await supabase.from('ar_titles').select('*').eq('id', titleId).single();
    if (!title) throw new Error("Título não encontrado");

    const newTitlePaid = Number(title.amount_paid) + diff;
    const newTitleOpen = Math.max(0, Number(title.amount_total) - newTitlePaid);

    // Status logic for title
    let newTitleStatus = title.status;
    if (newTitleOpen < 0.01) newTitleStatus = 'PAID';
    else if (newTitlePaid > 0 && (title.status === 'OPEN' || title.status === 'PENDING_APPROVAL')) newTitleStatus = 'PARTIAL';
    else if (newTitlePaid <= 0 && title.status === 'PARTIAL') newTitleStatus = 'OPEN'; // Revert to open if paid goes to 0?

    await supabase.from('ar_titles').update({
        amount_paid: newTitlePaid,
        amount_open: newTitleOpen,
        status: newTitleStatus
    }).eq('id', titleId);
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: paymentId } = await params;
    const supabase = await createClient();

    try {
        // 1. Get Payment & Allocation to know how much to revert
        // Assume 1 allocation per payment for now (simple model)
        const { data: allocation, error: allocError } = await supabase
            .from('ar_payment_allocations')
            .select('*, ar_installments(ar_title_id)')
            .eq('payment_id', paymentId)
            .single();

        if (allocError || !allocation) {
            // Check if payment exists without allocation (orphan check)
            const { data: pay } = await supabase.from('ar_payments').select('id').eq('id', paymentId).single();
            if (pay) {
                // Update: just delete the payment if no allocation
                await supabase.from('ar_payments').delete().eq('id', paymentId);
                return NextResponse.json({ success: true });
            }
            return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
        }

        const amount = Number(allocation.amount_allocated);
        const installmentId = allocation.installment_id;
        const titleId = allocation.ar_installments.ar_title_id;

        // 2. Delete Allocation & Payment
        await supabase.from('ar_payment_allocations').delete().eq('payment_id', paymentId);
        await supabase.from('ar_payments').delete().eq('id', paymentId);

        // 3. Update Balances (Revert amount: diff = -amount)
        await updateBalances(supabase, installmentId, titleId, -amount);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: paymentId } = await params;
    const body = await request.json();
    const { amount, paid_at, method } = body; // fields to update
    const supabase = await createClient();

    try {
        // 1. Get Current Allocation
        const { data: allocation, error: allocError } = await supabase
            .from('ar_payment_allocations')
            .select('*, ar_installments(*)')
            .eq('payment_id', paymentId)
            .single();

        if (allocError || !allocation) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });

        const oldAmount = Number(allocation.amount_allocated);
        const installment = allocation.ar_installments;
        const titleId = installment.ar_title_id;
        const newAmount = Number(amount);

        // Check bounds logic: 
        // Max allowed = CurrentOpen + OldAmount
        // NewAmount <= MaxAllowed
        const maxAllowed = Number(installment.amount_open) + oldAmount;

        if (newAmount > maxAllowed + 0.05) {
            return NextResponse.json({ error: 'Novo valor excede o saldo da parcela' }, { status: 400 });
        }

        const diff = newAmount - oldAmount;

        // 2. Update Payment
        await supabase.from('ar_payments').update({
            amount: newAmount,
            paid_at: paid_at,
            method: method
        }).eq('id', paymentId);

        // 3. Update Allocation
        if (diff !== 0) {
            await supabase.from('ar_payment_allocations').update({
                amount_allocated: newAmount
            }).eq('payment_id', paymentId);

            // 4. Update Balances
            await updateBalances(supabase, installment.id, titleId, diff);
        } else {
            // Even if amount didn't change, balances don't change, but we updated props.
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
