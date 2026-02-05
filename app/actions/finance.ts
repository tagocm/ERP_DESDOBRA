'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getActiveCompanyId } from '@/lib/auth/get-active-company'
import {
    listPendingAPTitles,
    approveAPTitle,
    rejectAPTitle,
    updateAPTitle,
    APTitle
} from '@/lib/finance/ap-db'

// --- Unified Actions ---

export async function listPendingTitlesAction() {
    const supabase = await createClient()
    const companyId = await getActiveCompanyId()
    if (!companyId) return { error: 'Company not found' }

    try {
        // Fetch AP
        const apTitles = await listPendingAPTitles(supabase, companyId)

        // Fetch AR (Mock or Real)
        // const arTitles = await listPendingARTitles(supabase, companyId) 
        // For now, let's implement AR query inline or import later.
        const { data: arTitlesData, error: arError } = await supabase
            .from('ar_titles')
            .select('*, customer:organizations(trade_name)')
            .eq('company_id', companyId)
            .eq('status', 'PENDING_APPROVAL')

        if (arError) throw arError

        // Process and Unify
        const ap = apTitles.map(t => ({ ...t, type: 'AP' as const, entity_name: t.supplier?.trade_name || 'Desconhecido' }))
        const ar = (arTitlesData || []).map(t => ({ ...t, type: 'AR' as const, entity_name: t.customer?.trade_name || 'Desconhecido' }))

        return { data: [...ap, ...ar] }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { error: message }
    }
}

interface InstallmentInput {
    amount_original: number;
    due_date: string;
    // Add other known fields if needed
    [key: string]: unknown;
}

export async function approveTitleAction(id: string, type: 'AP' | 'AR', installments: InstallmentInput[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    try {
        if (type === 'AP') {
            await approveAPTitle(supabase, id, user.id, installments)
        } else {
            // AR Approval Logic (Inline for now or move to lib/finance/ar-db.ts)
            // 1. Update Title
            const { error: titleError } = await supabase
                .from('ar_titles')
                .update({
                    status: 'OPEN',
                    approved_at: new Date().toISOString(),
                    approved_by: user.id,
                    attention_status: null,
                    attention_reason: null
                })
                .eq('id', id);
            if (titleError) throw titleError;

            // 2. Installments: usually Sales creates installments automatically on logistic status change.
            // But if we are "approving" it might mean regenerating them or just confirming.
            // User requirement: "Aprovar: muda status para OPEN e gera (ou recalcula) parcelas"

            // Delete existing
            await supabase.from('ar_installments').delete().eq('ar_title_id', id);

            // Insert New
            const { error: instError } = await supabase
                .from('ar_installments')
                .insert(installments.map(inst => ({
                    ...inst,
                    ar_title_id: id,
                    status: 'OPEN',
                    amount_open: inst.amount_original
                })));
            if (instError) throw instError;
        }

        revalidatePath('/app/financeiro/pre-aprovacao')
        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { error: message }
    }
}

export async function rejectTitleAction(id: string, type: 'AP' | 'AR') {
    const supabase = await createClient()
    try {
        if (type === 'AP') {
            await rejectAPTitle(supabase, id)
        } else {
            await supabase.from('ar_titles').update({ status: 'CANCELLED' }).eq('id', id)
        }
        revalidatePath('/app/financeiro/pre-aprovacao')
        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { error: message }
    }
}

export async function updateTitleAction(id: string, type: 'AP' | 'AR', updates: {
    amount_total: number;
    payment_terms_snapshot?: string | null;
    payment_method_snapshot?: string | null;
    due_date?: string;
    [key: string]: unknown;
}): Promise<{ success: boolean } | { error: string }> {
    const supabase = await createClient()
    try {
        const payload: Partial<APTitle> = {
            amount_total: updates.amount_total,
            payment_terms_snapshot: updates.payment_terms_snapshot,
            payment_method_snapshot: updates.payment_method_snapshot,
            due_date: updates.due_date,
            // Keep attention until approved? Or maybe clear it if user "Updated"?
            // User requirement: "Editar: permite ajustar ... antes de aprovar (mantém PENDING_APPROVAL)"
            attention_status: 'CHECKED_UPDATED', // Optional: Indication it was reviewed
            attention_reason: null // Clear reason if resolved
        }

        if (type === 'AP') {
            await updateAPTitle(supabase, id, payload)
        } else {
            const { error } = await supabase.from('ar_titles').update(payload).eq('id', id)
            if (error) throw error
        }
        revalidatePath('/app/financeiro/pre-aprovacao')
        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { error: message }
    }
}
