'use server'

import { createClient } from '@/lib/supabase/action'
import { revalidatePath } from 'next/cache'
import {
    listPendingAPTitles,
    approveAPTitle,
    rejectAPTitle,
    updateAPTitle,
    APTitle
} from '@/lib/finance/ap-db'

// We will need AR functions eventually from an 'ar-db.ts' or similar, 
// for now focusing on AP as per immediate request, but enabling Unified Structure.
// Assuming we can list AR titles with similar query.

async function getActiveCompanyId() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Simplify for now, assuming single company or derived from session/profile
    // In strict multi-tenant, we should get this from the request context or safe session storage
    // using the pattern:
    const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('user_id', user.id).single()
    return profile?.company_id
}

// --- Unified Actions ---

export async function listPendingTitlesAction() {
    const supabase = createClient()
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
        const ap = apTitles.map(t => ({ ...t, type: 'AP', entity_name: t.supplier?.trade_name || 'Desconhecido' }))
        const ar = (arTitlesData || []).map(t => ({ ...t, type: 'AR', entity_name: t.customer?.trade_name || 'Desconhecido' }))

        return { data: [...ap, ...ar] }
    } catch (error: any) {
        return { error: error.message }
    }
}

export async function approveTitleAction(id: string, type: 'AP' | 'AR', installments: any[]) {
    const supabase = createClient()
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
    } catch (error: any) {
        return { error: error.message }
    }
}

export async function rejectTitleAction(id: string, type: 'AP' | 'AR') {
    const supabase = createClient()
    try {
        if (type === 'AP') {
            await rejectAPTitle(supabase, id)
        } else {
            await supabase.from('ar_titles').update({ status: 'CANCELLED' }).eq('id', id)
        }
        revalidatePath('/app/financeiro/pre-aprovacao')
        return { success: true }
    } catch (error: any) {
        return { error: error.message }
    }
}

export async function updateTitleAction(id: string, type: 'AP' | 'AR', updates: any) {
    const supabase = createClient()
    try {
        const payload = {
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
    } catch (error: any) {
        return { error: error.message }
    }
}
