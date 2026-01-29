
export type FinancialStatus = 'PENDING_APPROVAL' | 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'ON_HOLD';
export type InstallmentStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface ArTitle {
    id: string;
    sales_document_id: string; // Optional if manual? Schema says NOT NULL but maybe future manual
    company_id: string;
    customer_id: string;

    document_number?: string; // Changed to string
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

    // Virtual for UI Unification
    type?: 'AR';
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

    // Reversal Fields
    status?: 'COMPLETED' | 'REVERSED';
    original_payment_id?: string;
    reversal_reason?: string;
}

export interface ArPaymentAllocation {
    id: string;
    payment_id: string;
    installment_id: string;
    amount_allocated: number;
    // Joined
    ar_payments?: ArPayment;
}

// --- AP TYPES ---

export interface ApTitle {
    id: string;
    purchase_order_id?: string;
    company_id: string;
    supplier_id: string;

    document_number?: string;
    status: FinancialStatus;

    amount_total: number;
    amount_paid: number;
    amount_open: number;

    payment_terms_snapshot?: string;
    payment_method_snapshot?: string;
    date_issued?: string;

    created_at: string;
    approved_at?: string;

    attention_status?: 'EM_ATENCAO' | null;
    attention_reason?: string;

    // Joined Associations
    // Purchase Order logic differs from Sales, might be null
    purchase_order?: {
        id: string;
        // Add fields as needed
    };
    organization?: { // Supplier
        id: string;
        trade_name: string;
        legal_name?: string;
    } | null;

    ap_installments?: ApInstallment[];
}

export interface ApInstallment {
    id: string;
    ap_title_id: string;
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
    ap_title?: ApTitle;
    ap_payment_allocations?: ApPaymentAllocation[];

    // Virtual for UI Unification
    type?: 'AP';
}

export interface ApPayment {
    id: string;
    company_id: string;
    supplier_id: string;
    amount: number;
    paid_at: string;
    method: string;
    reference?: string;
    notes?: string;
    created_at?: string;

    // Reversal Fields
    status?: 'COMPLETED' | 'REVERSED';
    original_payment_id?: string;
    reversal_reason?: string;
}

export interface ApPaymentAllocation {
    id: string;
    payment_id: string;
    installment_id: string;
    amount_allocated: number;
    ap_payments?: ApPayment;
}

export type FinancialInstallment = (ArInstallment & { type: 'AR' }) | (ApInstallment & { type: 'AP' });
