import { SupabaseClient } from '@supabase/supabase-js';

// --- Unified DTO ---
export interface UnifiedFinancialTitle {
    id: string;
    company_id: string;
    flow: 'AR' | 'AP'; // Generated

    // Unified Entity Info
    entity_id: string;
    entity_name: string; // trade_name of customer or supplier
    document_string: string; // formatted document number (CPF/CNPJ)

    // Common Fields
    document_number?: string | number;
    sales_order_number?: string | number; // From relation
    purchase_order_number?: string | number; // From relation

    amount_total: number;
    amount_open: number;

    status: 'PENDING_APPROVAL' | 'OPEN' | 'PAID' | 'CANCELLED';

    date_issued?: string;
    created_at: string;

    // Snapshots
    payment_terms_snapshot?: string;
    payment_method_snapshot?: string;

    // Attention
    attention_status?: string;
    attention_reason?: string;
    attention_at?: string;

    // Installments Preview
    installments_count: number;
    first_due_date?: string;
}

// --- Repository Functions ---

export async function listPendingApprovals(supabase: SupabaseClient, companyId: string): Promise<UnifiedFinancialTitle[]> {
    // 1. Fetch AR Titles (Receivables)
    const { data: arData, error: arError } = await supabase
        .from('ar_titles')
        .select(`
            *,
            customer:organizations!customer_id(id, trade_name, document_number),
            sales_document:sales_documents(document_number),
            installments:ar_installments(due_date)
        `)
        .eq('company_id', companyId)
        .eq('status', 'PENDING_APPROVAL');

    if (arError) throw arError;

    // 2. Fetch AP Titles (Payables)
    const { data: apData, error: apError } = await supabase
        .from('ap_titles')
        .select(`
            *,
            supplier:organizations!supplier_id(id, trade_name, document_number),
            purchase_order:purchase_orders(document_number),
            installments:ap_installments(due_date)
        `)
        .eq('company_id', companyId)
        .eq('status', 'PENDING_APPROVAL');

    if (apError) throw apError;

    // 3. Map to Unified DTO
    const unifiedAR = (arData || []).map((item: any) => mapToUnified(item, 'AR'));
    const unifiedAP = (apData || []).map((item: any) => mapToUnified(item, 'AP'));

    // 4. Sort by created_at desc
    return [...unifiedAR, ...unifiedAP].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

function mapToUnified(item: any, flow: 'AR' | 'AP'): UnifiedFinancialTitle {
    const entity = flow === 'AR' ? item.customer : item.supplier;
    const installments = item.installments || [];

    // Sort installments to find first due date
    installments.sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const firstDueDate = installments.length > 0 ? installments[0].due_date : undefined;

    return {
        id: item.id,
        company_id: item.company_id,
        flow,
        entity_id: entity?.id,
        entity_name: entity?.trade_name || 'Desconhecido',
        document_string: entity?.document_number || '',

        document_number: item.document_number,
        sales_order_number: item.sales_document?.document_number,
        purchase_order_number: item.purchase_order?.document_number,

        amount_total: Number(item.amount_total || 0),
        amount_open: Number(item.amount_open || 0),

        status: item.status,
        date_issued: item.date_issued,
        created_at: item.created_at,

        payment_terms_snapshot: item.payment_terms_snapshot,
        payment_method_snapshot: item.payment_method_snapshot,

        attention_status: item.attention_status,
        attention_reason: item.attention_reason,
        attention_at: item.attention_at, // Accessing dynamic field if exists

        installments_count: installments.length,
        first_due_date: firstDueDate
    };
}

export async function approveTitle(supabase: SupabaseClient, flow: 'AR' | 'AP', id: string, userId: string) {
    const table = flow === 'AR' ? 'ar_titles' : 'ap_titles';
    const installmentsTable = flow === 'AR' ? 'ar_installments' : 'ap_installments';
    const fk = flow === 'AR' ? 'ar_title_id' : 'ap_title_id';

    // 1. Update Title to OPEN
    const { error: updateError } = await supabase
        .from(table)
        .update({
            status: 'OPEN',
            approved_at: new Date().toISOString(),
            approved_by: userId,
            attention_status: null,
            attention_reason: null
        })
        .eq('id', id);

    if (updateError) throw updateError;

    // 2. Ensure Installments Exist (Auto-generate single if missing)
    // Only if count is 0. If they exist (preview), we keep them (now valid).
    // NOTE: In a real scenario, approval might trigger re-calculation. 
    // Here we assume if they exist, they are correct. If not, we create 1x.
    const { count, error: countError } = await supabase
        .from(installmentsTable)
        .select('*', { count: 'exact', head: true })
        .eq(fk, id);

    if (!countError && count === 0) {
        // Fetch title amount
        const { data: title } = await supabase.from(table).select('amount_total, due_date').eq('id', id).single();
        if (title) {
            await supabase.from(installmentsTable).insert({
                [fk]: id,
                installment_number: 1,
                due_date: title.due_date || new Date().toISOString(), // Fallback
                amount_original: title.amount_total,
                amount_open: title.amount_total,
                status: 'OPEN'
            });
        }
    }
}

export async function rejectTitle(supabase: SupabaseClient, flow: 'AR' | 'AP', id: string, reason: string, userId: string) {
    const table = flow === 'AR' ? 'ar_titles' : 'ap_titles';

    // We might want to store the reason in a log or a column.
    // For now assuming we just cancel.
    const { error } = await supabase
        .from(table)
        .update({
            status: 'CANCELLED',
            // cancellation_reason: reason // If column existed
        })
        .eq('id', id);

    if (error) throw error;
}

export async function markAttention(supabase: SupabaseClient, flow: 'AR' | 'AP', id: string, reason: string) {
    const table = flow === 'AR' ? 'ar_titles' : 'ap_titles';

    const { error } = await supabase
        .from(table)
        .update({
            attention_status: 'EM_ATENCAO',
            attention_reason: reason,
            // attention_at: new Date().toISOString() // If column exists
        })
        .eq('id', id);

    if (error) throw error;
}
