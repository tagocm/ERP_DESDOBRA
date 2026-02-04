'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    listPendingApprovals,
    approveTitle,
    rejectTitle,
    markAttention,
    UnifiedFinancialTitle
} from '@/lib/finance/approvals-db'

async function getActiveCompanyId() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Simple resolution for now
    const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .limit(1)
        .single();

    return member?.company_id || user.user_metadata?.company_id
}

export async function listPendingApprovalsAction() {
    const supabase = await createClient()
    const companyId = await getActiveCompanyId()
    if (!companyId) return { error: 'Company not found' }

    try {
        const data = await listPendingApprovals(supabase, companyId)
        return { data }
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' }
    }
}

export async function approveUnifiedAction(flow: 'AR' | 'AP', id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    try {
        await approveTitle(supabase, flow, id, user.id)
        revalidatePath('/app/financeiro/aprovacoes')
        return { success: true }
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' }
    }
}

export async function rejectUnifiedAction(flow: 'AR' | 'AP', id: string, reason: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    try {
        await rejectTitle(supabase, flow, id, reason, user.id)
        revalidatePath('/app/financeiro/aprovacoes')
        return { success: true }
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' }
    }
}

export async function markAttentionAction(flow: 'AR' | 'AP', id: string, reason: string) {
    const supabase = await createClient()
    try {
        await markAttention(supabase, flow, id, reason)
        revalidatePath('/app/financeiro/aprovacoes')
        return { success: true }
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' }
    }
}
