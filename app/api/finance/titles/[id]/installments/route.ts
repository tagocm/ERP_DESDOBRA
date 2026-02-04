import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

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

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params; // Title ID
    const installmentsPayload = await request.json(); // Array of { id?, due_date, amount_original, payment_method? }
    const supabase = await createClient();

    if (!Array.isArray(installmentsPayload) || installmentsPayload.length === 0) {
        return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    try {
        // 1. Fetch Title & Existing Installments
        const { data: title, error: titleError } = await supabase
            .from('ar_titles')
            .select('amount_total, status, company_id')
            .eq('id', id)
            .single();

        if (titleError || !title) throw new Error('Título não encontrado');

        const { data: existingInstallments, error: instError } = await supabase
            .from('ar_installments')
            .select('id, amount_paid')
            .eq('ar_title_id', id);

        if (instError) throw instError;

        // 2. Validate Sum
        const sumParams = installmentsPayload.reduce((acc: number, curr: any) => acc + Number(curr.amount_original || 0), 0);
        const diff = Math.abs(sumParams - Number(title.amount_total));

        if (diff > 0.05) {
            return NextResponse.json({
                error: `A soma das parcelas (R$ ${sumParams.toFixed(2)}) não bate com o total do título (R$ ${title.amount_total}). Diferença: ${diff.toFixed(2)}`
            }, { status: 400 });
        }

        // 3. Identify Operations
        const payloadIds = new Set(installmentsPayload.filter((i: any) => i.id).map((i: any) => i.id));
        const existingIds = new Set(existingInstallments.map(i => i.id));

        const toDelete = existingInstallments.filter(i => !payloadIds.has(i.id));
        const toUpdate = installmentsPayload.filter((i: any) => i.id && existingIds.has(i.id));
        const toInsert = installmentsPayload.filter((i: any) => !i.id);

        // 4. Check Deletion Constraints
        const lockedDeletion = toDelete.find(i => i.amount_paid > 0);
        if (lockedDeletion) {
            return NextResponse.json({ error: 'Não é possível excluir parcelas com pagamentos.' }, { status: 400 });
        }

        // 5. Execute Operations
        // Order: Delete -> Update -> Insert (to avoid conflicts if any constraints, though UUIDs are unique)

        // Delete
        if (toDelete.length > 0) {
            const { error: delErr } = await supabase
                .from('ar_installments')
                .delete()
                .in('id', toDelete.map(i => i.id));
            if (delErr) throw delErr;
        }

        // Update
        const updatePromises = toUpdate.map((inst: any) => {
            return supabase
                .from('ar_installments')
                .update({
                    due_date: inst.due_date,
                    amount_original: inst.amount_original,
                    payment_method: inst.payment_method, // Sync payment method
                    // Update amount_open if amount_original changed? 
                    // Logic: amount_open = amount_original - amount_paid.
                    // We need amount_paid from existing record.
                    // But we can't easily reference it in a simple update without a stored procedure or fetching it (which we partly did in existingInstallments but need mapping).
                    // Or keep it simple: If paid > 0, we assume user knows what they are doing resizing original.
                    // Or update amount_open = inst.amount_original - (existing.amount_paid).
                })
                .eq('id', inst.id);
        });

        // Handling amount_open update correctly:
        // We know amount_paid from existingInstallments map.
        // It's safer to not touch amount_open blindly.
        // But if I increase original, open should increase.
        // I will do a more robust update for updates:
        for (const inst of toUpdate) {
            const existing = existingInstallments.find(e => e.id === inst.id);
            const paid = existing?.amount_paid || 0;
            const newOriginal = Number(inst.amount_original);
            const newOpen = Math.max(0, newOriginal - paid);

            await supabase.from('ar_installments').update({
                due_date: inst.due_date,
                amount_original: newOriginal,
                amount_open: newOpen,
                payment_method: inst.payment_method,
                installment_number: inst.installment_number // Update number order if reordered?
            }).eq('id', inst.id);
        }

        // Insert
        if (toInsert.length > 0) {
            const insertData = toInsert.map((inst: any, idx: number) => ({
                ar_title_id: id,
                company_id: title.company_id,
                installment_number: inst.installment_number, // Should affect numbering logic
                due_date: inst.due_date,
                amount_original: inst.amount_original,
                amount_open: inst.amount_original,
                amount_paid: 0,
                status: 'OPEN',
                payment_method: inst.payment_method
            }));

            const { error: insErr } = await supabase
                .from('ar_installments')
                .insert(insertData);
            if (insErr) throw insErr;
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[finance/titles/installments] Error', { titleId: id, message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Erro ao atualizar parcelas' : message },
            { status: 500 }
        );
    }
}
