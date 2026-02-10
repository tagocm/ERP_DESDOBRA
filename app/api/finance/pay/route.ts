import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    const limitConfig = process.env.NODE_ENV === 'production'
        ? { limit: 60, windowMs: 60_000 }
        : { limit: 300, windowMs: 60_000 };
    const limit = rateLimit(req, { key: 'finance-pay', ...limitConfig });
    if (!limit.ok) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const supabase = await createClient();

    try {
        const body = await req.json();
        const { title_id, amount, method, notes, paid_at } = body;
        const amountNum = Number(amount);

        if (!title_id || !amount || amountNum <= 0) {
            return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // 1. Fetch Title to get Context (Company, Customer)
        const { data: title, error: titleError } = await supabase
            .from('ar_titles')
            .select('*')
            .eq('id', title_id)
            .single();

        if (titleError || !title) throw new Error('Título não encontrado');

        // 2. Fetch Installments (Open ones first, ordered by date)
        const { data: installments, error: instError } = await supabase
            .from('ar_installments')
            .select('*')
            .eq('ar_title_id', title_id)
            .gt('amount_open', 0) // Only open ones
            .order('due_date', { ascending: true })
            .order('installment_number', { ascending: true });

        if (instError) throw instError;

        // 3. Create Payment Record
        const { data: payment, error: payError } = await supabase
            .from('ar_payments')
            .insert({
                company_id: title.company_id,
                customer_id: title.customer_id,
                amount: amountNum,
                paid_at: paid_at || new Date().toISOString(),
                method: method || 'Manual',
                notes: notes,
                created_by: user?.id
            })
            .select()
            .single();

        if (payError) throw payError;

        // 4. Allocate Logic
        let remaining = amountNum;
        const allocations = [];

        // We will update installments one by one (or batch if possible, but logic varies)

        for (const inst of installments) {
            if (remaining <= 0) break;

            const allocAmount = Math.min(remaining, Number(inst.amount_open));

            if (allocAmount > 0) {
                const newPaid = Number(inst.amount_paid) + allocAmount;
                const newOpen = Number(inst.amount_open) - allocAmount;
                let newStatus = inst.status;

                if (newOpen <= 0.01) { // Floating point tolerance
                    newStatus = 'PAID';
                } else {
                    newStatus = 'PARTIAL';
                }

                // Update Installment
                await supabase
                    .from('ar_installments')
                    .update({
                        amount_paid: newPaid,
                        amount_open: newOpen, // actually can be 0
                        status: newStatus
                    })
                    .eq('id', inst.id);

                // Prepare Allocation Record
                allocations.push({
                    payment_id: payment.id,
                    installment_id: inst.id,
                    amount_allocated: allocAmount
                });

                remaining -= allocAmount;
            }
        }

        // 5. Insert Allocations
        if (allocations.length > 0) {
            const { error: allocError } = await supabase
                .from('ar_payment_allocations')
                .insert(allocations);

            if (allocError) {
                logger.warn('[finance/pay] Failed saving allocations', {
                    code: allocError.code,
                    message: allocError.message
                });
            }
        }

        // 6. Update Title Totals (Re-fetch or calculate)
        // Simplest is to increment paid amount
        const titleNewPaid = Number(title.amount_paid) + (amountNum - remaining); // Only what was allocated? 
        // Or if overpaid, we still record it? 
        // For now, let's assume we update title.amount_paid with FULL payment amount or just allocated?
        // Usually Title Paid = Sum of allocated installments? Or sum of Payments attached?
        // Let's stick to "Amount Paid on Title" = Sum of allocations usually.
        // But if there is overpayment (credit)? 
        // MVP: Update title.amount_open.

        const titleNewOpen = Math.max(0, Number(title.amount_open) - (amountNum - remaining));
        // If remaining > 0, we have unallocated credit. But let's just reduce open.

        const titleStatus = titleNewOpen <= 0.01 ? 'PAID' : (title.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'OPEN');
        // If it was OPEN/PARTIAL.
        // If it sends PARTIAL logic.

        await supabase.from('ar_titles').update({
            amount_paid: Number(title.amount_paid) + amountNum, // Total received
            amount_open: titleNewOpen,
            status: titleStatus === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : (titleNewOpen <= 0.01 ? 'PAID' : 'OPEN')
            // Keep PENDING if it was pending? Usually you don't pay pending titles. But let's allow it.
        }).eq('id', title_id);


        return NextResponse.json({ success: true, allocated: amountNum - remaining });

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('[finance/pay] Error', { message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Erro interno' : message },
            { status: 500 }
        );
    }
}
