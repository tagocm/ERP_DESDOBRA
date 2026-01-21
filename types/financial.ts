export type FinancialStatus = 'PENDING_APPROVAL' | 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'ON_HOLD';
export type InstallmentStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface ArTitle {
    id: string;
    sales_document_id: string;
    company_id: string;
    customer_id: string;

    document_number?: number;
    status: FinancialStatus;

    amount_total: number;
    amount_paid: number;
    amount_open: number;

    payment_terms_snapshot?: string;
    payment_method_snapshot?: string;
    date_issued?: string;

    created_at: string;
    approved_at?: string;

    // Attention Flags (Exit Route Logic)
    attention_status?: 'EM_ATENCAO' | null;
    attention_reason?: string;
    attention_at?: string;

    // Joined Associations
    sales_document?: {
        id: string;
        document_number: number;
        status_logistic: string;
        financial_status: string; // "Processamento" status from sales_documents
    };
    organization?: {
        id: string;
        trade_name: string;
        legal_name?: string;
    } | null;

    ar_installments?: ArInstallment[];
}

export interface ArInstallment {
    id: string;
    ar_title_id: string;
    installment_number: number;
    due_date: string;

    amount_original: number;
    amount_paid: number;
    amount_open: number;

    status: InstallmentStatus;

    interest_amount: number;
    penalty_amount: number;
    discount_amount: number;
    payment_method?: string;

    // Joined
    ar_title?: ArTitle;
    ar_payment_allocations?: ArPaymentAllocation[];
}

export interface ArPayment {
    id: string;
    company_id: string;
    customer_id: string;
    amount: number;
    paid_at: string;
    method: string;
    reference?: string;
    notes?: string;
    created_at?: string;
}

export interface ArPaymentAllocation {
    id: string;
    payment_id: string;
    installment_id: string;
    amount_allocated: number;
    // Joined
    ar_payments?: ArPayment;
}
