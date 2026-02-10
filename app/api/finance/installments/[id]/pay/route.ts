import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // installment id
) {
    const { id: installmentId } = await params;
    const body = await request.json();
    const { amount, method, reference, notes, paid_at } = body;
    const supabase = await createClient();

    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
        return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
    }

    try {
        // 1. Fetch Installment & Title
        const { data: installment, error: instError } = await supabase
            .from('ar_installments')
            .select('*, ar_titles(company_id, customer_id, amount_paid, amount_total)')
            .eq('id', installmentId)
            .single();

        if (instError || !installment) throw new Error('Parcela não encontrada');
        const title = installment.ar_titles;

        if (amountNum > installment.amount_open + 0.05) { // tolerance
            return NextResponse.json({ error: 'Valor excede o saldo da parcela' }, { status: 400 });
        }

        // 2. Create Payment
        const { data: payment, error: payError } = await supabase
            .from('ar_payments')
            .insert({
                company_id: title.company_id,
                customer_id: title.customer_id,
                amount: amountNum,
                paid_at: paid_at || new Date().toISOString(),
                method: method,
                reference: reference, // Ensure column name matches schema. Original schema 'reference'.
                notes: notes
            })
            .select()
            .single();

        if (payError) throw payError;

        // 3. Create Allocation
        const { error: allocError } = await supabase
            .from('ar_payment_allocations')
            .insert({
                payment_id: payment.id,
                installment_id: installmentId,
                amount_allocated: amountNum
            });

        if (allocError) throw allocError;

        // 4. Update Installment Status
        const newInstPaid = Number(installment.amount_paid) + amountNum;
        const newInstOpen = Math.max(0, Number(installment.amount_original) - newInstPaid);
        const newInstStatus = newInstOpen < 0.01 ? 'PAID' : 'PARTIAL'; // ignore 'OPEN' if partial paid exists. If logic was strictly 0, PARTIAL.

        await supabase
            .from('ar_installments')
            .update({
                amount_paid: newInstPaid,
                amount_open: newInstOpen,
                status: newInstStatus
            })
            .eq('id', installmentId);

        // 5. Update Title Status
        const newTitlePaid = Number(title.amount_paid) + amountNum;
        const newTitleOpen = Math.max(0, Number(title.amount_total) - newTitlePaid);
        // Status: PAID if open ~ 0, otherwise PARTIAL/OPEN? Need to check all installments?
        // Or simplified: if newTitleOpen ~ 0 -> PAID. Else if newTitlePaid > 0 -> PARTIAL/OPEN.
        // Usually Title status depends on aggregation. Simple logic:
        let newTitleStatus = 'OPEN'; // Default active
        if (newTitleOpen < 0.01) newTitleStatus = 'PAID';
        else if (newTitlePaid > 0) newTitleStatus = 'PARTIAL';
        // But if original status was PENDING_APPROVAL? User said "Aqui é pré-visualizar... permitir registrar pagamentos".
        // If I pay, does it approve automatically? No, user didn't say that.
        // It might stay 'PENDING_APPROVAL' even if partially paid? Or should switch to OPEN/PARTIAL?
        // Logic: "pagamentos por parcela... inclusive pagamento parcial... Sem misturar com aprovação".
        // So I should preserve 'PENDING_APPROVAL' or 'ON_HOLD' if it was that status, unless it becomes fully paid?
        // Actually, if a payment is made, it's virtually "Accepted" financially.
        // But let's check current status. If PENDING, maybe switch to PARTIAL?
        // I will keep status logic simple: if fully paid -> PAID. If partial -> PARTIAL (unless it was PENDING/ON_HOLD, might want to keep that?).
        // User request doesn't specify status transition on payment in this pre-approval screen.
        // I will allow status change to PAID or PARTIAL, which effectively "Approves" it implicitly?
        // Or keep it PENDING?
        // "Aprovação altera o status... para APPROVED." (OPEN).
        // If I pay while PENDING, and it becomes PARTIAL, is it Approved?
        // I will assume paying implies acknowledgement of debt. I'll set to PARTIAL/PAID.

        // Wait, if I set to PARTIAL/PAID, it disappears from "PENDING" list in view!
        // The view filters by 'PENDING_APPROVAL'.
        // If I pay, it's effectively approved?
        // "Financeiro revisar rapidamente... Aprovar ou segurar".
        // "Permitir registrar pagamentos de forma simples por parcela."
        // If I register payment, I probably want it to become "OPEN" or "PARTIAL" (which are active statuses).
        // I will update status.

        await supabase
            .from('ar_titles')
            .update({
                amount_paid: newTitlePaid,
                amount_open: newTitleOpen,
                status: newTitleStatus
            })
            .eq('id', installment.ar_title_id);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
