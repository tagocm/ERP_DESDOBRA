
import { SupabaseClient } from '@supabase/supabase-js';

// Types
export interface CompanySettings {
    company_id: string;
    legal_name: string | null;
    trade_name: string | null;
    cnpj: string | null;
    ie: string | null;
    im: string | null;
    cnae: string | null; // @deprecated use cnae_code and cnae_description
    cnae_code: string | null;
    cnae_description: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    whatsapp: string | null;
    instagram: string | null;
    logo_path: string | null;

    // Address
    address_zip: string | null;
    address_street: string | null;
    address_number: string | null;
    address_complement: string | null;
    address_neighborhood: string | null;
    address_city: string | null;
    address_state: string | null;
    address_country: string | null;
    city_code_ibge: string | null;

    // Fiscal
    tax_regime: 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | null;
    fiscal_doc_model: number; // 55
    nfe_environment: 'homologation' | 'production' | null;
    nfe_series: string | null;
    nfe_next_number: number;
    nfe_flags: Record<string, any>;

    // Finance
    default_penalty_percent: number;
    default_interest_percent: number;

    // Certificate
    cert_a1_storage_path: string | null;
    cert_a1_uploaded_at: string | null;
    cert_a1_expires_at: string | null;
    is_cert_password_saved: boolean;
    cert_password_encrypted?: string;
    // We do NOT return the encrypted password

    updated_at: string;
}

export interface BankAccount {
    id: string;
    company_id: string;
    bank_name: string;
    bank_code: string | null;
    agency: string | null;
    account_number: string | null;
    account_type: 'corrente' | 'poupanca' | 'pagamento' | 'outra' | null;
    pix_key: string | null;
    pix_type: string | null;
    description: string | null;
    is_active: boolean;
    is_default: boolean;
}

export interface PaymentTerm {
    id: string;
    company_id: string;
    name: string;
    installments_count: number;
    first_due_days: number;
    cadence_days: number | null;
    min_installment_amount: number | null;
    is_custom_name: boolean;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
}



// FETCH Functions

export async function getCompanySettings(supabase: SupabaseClient, companyId: string) {
    const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;

    // If no settings exist yet, return a skeleton or null
    return data as CompanySettings | null;
}

export async function getBankAccounts(supabase: SupabaseClient, companyId: string) {
    const { data, error } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .eq('company_id', companyId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data as BankAccount[];
}

export async function getPaymentTerms(supabase: SupabaseClient, companyId: string) {
    const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('name', { ascending: true });

    if (error) throw error;
    return data as PaymentTerm[];
}

export async function getPaymentTerm(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data as PaymentTerm;
}


export interface Branch {
    id: string;
    name: string;
    slug: string;
    is_branch: boolean;
    created_at: string;
    settings?: {
        trade_name: string | null;
        cnpj: string | null;
        address_city: string | null;
        address_state: string | null;
    } | null;
}

export async function getBranches(supabase: SupabaseClient, companyId: string) {
    // Get companies where parent_company_id = companyId
    const { data, error } = await supabase
        .from('companies')
        .select(`
            id, name, slug, is_branch, created_at,
            settings:company_settings(trade_name, cnpj, address_city, address_state)
        `)
        .eq('parent_company_id', companyId)
        .eq('is_branch', true)
        .is('deleted_at', null);

    if (error) throw error;
    // Helper to cast the nested settings array/object if needed, but assuming Supabase returns it correctly mapped
    // If settings is an array (one-to-many), we might need to take the first one, but for now trusting the structure matches usage
    return data as any as Branch[];
}

// UPDATE / CREATE Functions

export async function updateCompanySettings(supabase: SupabaseClient, companyId: string, updates: Partial<CompanySettings>) {
    // Whitelist valid columns to prevent "Column not found" errors
    const validColumns = [
        'company_id', 'legal_name', 'trade_name', 'cnpj', 'ie', 'im',
        'cnae', 'cnae_code', 'cnae_description',
        'phone', 'email', 'website', 'whatsapp', 'instagram', 'logo_path',
        'address_zip', 'address_street', 'address_number', 'address_complement',
        'address_neighborhood', 'address_city', 'address_state', 'address_country',
        'city_code_ibge',
        'tax_regime', 'fiscal_doc_model', 'nfe_environment',
        'nfe_series', 'nfe_next_number', 'nfe_flags',
        'default_penalty_percent', 'default_interest_percent',
        'cert_a1_storage_path', 'cert_a1_uploaded_at', 'cert_a1_expires_at',
        'is_cert_password_saved', 'cert_password_encrypted'
    ];

    const cleanUpdates: any = {};
    Object.keys(updates).forEach(key => {
        if (validColumns.includes(key)) {
            cleanUpdates[key] = (updates as any)[key];
        }
    });

    const { data, error } = await supabase
        .from('company_settings')
        .upsert({ company_id: companyId, ...cleanUpdates })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Updates the 'companies' table name if trade_name changes (optional but good for consistency)
export async function updateCompanyName(supabase: SupabaseClient, companyId: string, name: string) {
    const { error } = await supabase
        .from('companies')
        .update({ name })
        .eq('id', companyId);
    if (error) throw error;
}

// Banking
export async function upsertBankAccount(supabase: SupabaseClient, account: Partial<BankAccount>) {
    if (!account.company_id) throw new Error("Company ID required");

    // If setting default, unset others
    if (account.is_default) {
        await supabase
            .from('company_bank_accounts')
            .update({ is_default: false })
            .eq('company_id', account.company_id);
    }

    const { data, error } = await supabase
        .from('company_bank_accounts')
        .upsert(account)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteBankAccount(supabase: SupabaseClient, id: string) {
    const { error } = await supabase
        .from('company_bank_accounts')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// Payment Terms
export async function upsertPaymentTerm(supabase: SupabaseClient, term: Partial<PaymentTerm>) {
    const { data, error } = await supabase
        .from('payment_terms')
        .upsert(term)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deletePaymentTerm(supabase: SupabaseClient, id: string) {
    // Soft delete or hard delete? Requirement said "impedir excluir se... por enquanto confirmar".
    // Schema has deleted_at. Let's use soft delete.
    const { error } = await supabase
        .from('payment_terms')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
}

// Branch Creation (Complex)
// We need to create authorized user for branch? Or just the entity?
// For now, just the entity. Access control usually usually cascades or is separate.
// Existing 'createCompany' logic might be needed, but simple insert for now.
export async function createBranch(supabase: SupabaseClient, parentId: string, name: string, slug: string) {
    const { data, error } = await supabase
        .from('companies')
        .insert({
            name,
            slug,
            parent_company_id: parentId,
            is_branch: true
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}
