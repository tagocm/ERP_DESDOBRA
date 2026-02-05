import { SupabaseClient } from '@supabase/supabase-js';

// --- Interfaces ---

export interface APTitle {
    id: string;
    company_id: string;
    purchase_order_id?: string | null;
    supplier_id: string;
    document_number?: string | null;
    status: 'PENDING_APPROVAL' | 'OPEN' | 'PAID' | 'CANCELLED';
    amount_total: number;
    amount_paid: number;
    amount_open: number;
    payment_terms_snapshot?: string | null;
    payment_method_snapshot?: string | null;
    date_issued?: string | null;
    due_date?: string | null;
    attention_status?: string | null;
    attention_reason?: string | null;
    created_at: string | null;

    supplier?: {
        trade_name: string;
    };
}

export interface APInstallment {
    id: string;
    ap_title_id: string;
    installment_number: number;
    due_date: string;
    amount_original: number;
    amount_open: number;
    status: string;
}

// --- Repository Functions ---

export async function listPendingAPTitles(supabase: SupabaseClient, companyId: string) {
    const { data, error } = await supabase
        .from('ap_titles')
        .select(`
            *,
            supplier:organizations(trade_name)
        `)
        .eq('company_id', companyId)
        .eq('status', 'PENDING_APPROVAL')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error listing pending AP titles:', error);
        throw error;
    }

    return data as APTitle[];
}

export async function getAPTitleById(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
        .from('ap_titles')
        .select(`
            *,
            supplier:organizations(trade_name),
            installments:ap_installments(*)
        `)
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

export async function approveAPTitle(supabase: SupabaseClient, id: string, userId: string, installments: any[]) {
    // 1. Update Title Status
    const { error: titleError } = await supabase
        .from('ap_titles')
        .update({
            status: 'OPEN',
            approved_at: new Date().toISOString(),
            approved_by: userId,
            attention_status: null, // Clear attention on approval
            attention_reason: null
        })
        .eq('id', id);

    if (titleError) throw titleError;

    // 2. Create/Replace Installments
    // First delete existing (if any were previewed/drafted, though usually created on approval)
    await supabase.from('ap_installments').delete().eq('ap_title_id', id);

    const { error: instError } = await supabase
        .from('ap_installments')
        .insert(installments.map(inst => ({
            ...inst,
            ap_title_id: id,
            status: 'OPEN',
            amount_open: inst.amount_original // Start fully open
        })));

    if (instError) throw instError;
}

export async function rejectAPTitle(supabase: SupabaseClient, id: string) {
    const { error } = await supabase
        .from('ap_titles')
        .update({ status: 'CANCELLED' })
        .eq('id', id);

    if (error) throw error;
}

export async function updateAPTitle(supabase: SupabaseClient, id: string, updates: Partial<APTitle>) {
    const { error } = await supabase
        .from('ap_titles')
        .update(updates)
        .eq('id', id);

    if (error) throw error;
}
