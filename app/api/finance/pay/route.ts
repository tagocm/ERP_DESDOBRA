import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function createClient() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
                    } catch { }
                },
            },
        }
    );
}

export async function POST(req: Request) {
    const supabase = await createClient();
    const body = await req.json();
    const { title_id, amount, method, notes, paid_at } = body;
    const amountNum = Number(amount);

    if (!title_id || !amount || amountNum <= 0) {
        return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();

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

            if (allocError) console.error('Error saving allocations:', allocError);
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

    } catch (e: any) {
        console.error('Payment error:', e);
        return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 });
    }
}
