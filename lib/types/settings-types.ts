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
