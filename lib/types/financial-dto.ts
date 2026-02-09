
// Financial Module DTOs
// Used to break dependency between UI and Data Layer (TRUE GOLD)

export type FinancialStatusDTO = 'PENDING_APPROVAL' | 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'ON_HOLD';
export type InstallmentStatusDTO = 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface ArTitleDTO {
    id: string;
    sales_document_id: string;
    company_id: string;
    customer_id: string;

    document_number?: string;
    status: FinancialStatusDTO;

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
    attention_at?: string;

    sales_document?: {
        id: string;
        document_number: number;
        status_logistic: string;
        financial_status: string;
    };
    organization?: {
        id: string;
        trade_name: string;
        legal_name?: string;
    } | null;

    ar_installments?: ArInstallmentDTO[];
}

export interface ArInstallmentDTO {
    id: string;
    ar_title_id: string;
    installment_number: number;
    due_date: string;

    amount_original: number;
    amount_paid: number;
    amount_open: number;

    status: InstallmentStatusDTO;

    interest_amount: number;
    penalty_amount: number;
    discount_amount: number;
    payment_method?: string;

    ar_title?: ArTitleDTO;
    ar_payment_allocations?: ArPaymentAllocationDTO[];

    type?: 'AR';
}

export interface ArPaymentDTO {
    id: string;
    company_id: string;
    customer_id: string;
    amount: number;
    paid_at: string;
    method: string;
    reference?: string;
    notes?: string;
    created_at?: string;

    status?: 'COMPLETED' | 'REVERSED';
    original_payment_id?: string;
    reversal_reason?: string;
}

export interface ArPaymentAllocationDTO {
    id: string;
    payment_id: string;
    installment_id: string;
    amount_allocated: number;
    ar_payments?: ArPaymentDTO;
}

// --- AP TYPES ---

export interface ApTitleDTO {
    id: string;
    purchase_order_id?: string;
    company_id: string;
    supplier_id: string;

    document_number?: string;
    status: FinancialStatusDTO;

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

    purchase_order?: {
        id: string;
    };
    organization?: {
        id: string;
        trade_name: string;
        legal_name?: string;
    } | null;

    ap_installments?: ApInstallmentDTO[];
}

export interface ApInstallmentDTO {
    id: string;
    ap_title_id: string;
    installment_number: number;
    due_date: string;

    amount_original: number;
    amount_paid: number;
    amount_open: number;

    status: InstallmentStatusDTO;

    interest_amount: number;
    penalty_amount: number;
    discount_amount: number;
    payment_method?: string;

    ap_title?: ApTitleDTO;
    ap_payment_allocations?: ApPaymentAllocationDTO[];

    type?: 'AP';
}

export interface ApPaymentDTO {
    id: string;
    company_id: string;
    supplier_id: string;
    amount: number;
    paid_at: string;
    method: string;
    reference?: string;
    notes?: string;
    created_at?: string;

    status?: 'COMPLETED' | 'REVERSED';
    original_payment_id?: string;
    reversal_reason?: string;
}

export interface ApPaymentAllocationDTO {
    id: string;
    payment_id: string;
    installment_id: string;
    amount_allocated: number;
    ap_payments?: ApPaymentDTO;
}

export type FinancialInstallmentDTO = (ArInstallmentDTO & { type: 'AR' }) | (ApInstallmentDTO & { type: 'AP' });
