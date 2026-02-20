export type FactorOperationStatus =
    | "draft"
    | "sent_to_factor"
    | "in_adjustment"
    | "completed"
    | "cancelled";

export type FactorItemAction =
    | "discount"
    | "buyback"
    | "due_date_change";

export type FactorResponseStatus =
    | "pending"
    | "accepted"
    | "rejected"
    | "adjusted";

export interface FactorOption {
    id: string;
    name: string;
}

export interface FactorOperationListItem {
    id: string;
    operation_number: number;
    reference: string | null;
    issue_date: string;
    gross_amount: number;
    costs_amount: number;
    net_amount: number;
    status: FactorOperationStatus;
    factor: {
        id: string;
        name: string;
    } | null;
}

export interface FactorOperation {
    id: string;
    operation_number: number;
    factor_id: string;
    reference: string | null;
    issue_date: string;
    expected_settlement_date: string | null;
    settlement_account_id: string | null;
    status: FactorOperationStatus;
    gross_amount: number;
    costs_amount: number;
    net_amount: number;
    version_counter: number;
    current_version_id: string | null;
    notes: string | null;
}

export interface FactorOperationItem {
    id: string;
    line_no: number;
    action_type: FactorItemAction;
    ar_installment_id: string;
    ar_title_id: string;
    installment_number_snapshot: number;
    due_date_snapshot: string;
    amount_snapshot: number;
    proposed_due_date: string | null;
    buyback_settle_now: boolean;
    status: FactorResponseStatus;
    final_amount: number | null;
    final_due_date: string | null;
    sales_document_id: string | null;
    customer_id: string | null;
    notes: string | null;
}

export interface FactorOperationVersion {
    id: string;
    version_number: number;
    source_status: FactorOperationStatus;
    total_items: number;
    gross_amount: number;
    costs_amount: number;
    net_amount: number;
    created_at: string;
}

export interface FactorOperationResponse {
    id: string;
    operation_item_id: string;
    response_status: FactorResponseStatus;
    response_code: string | null;
    response_message: string | null;
    accepted_amount: number | null;
    adjusted_amount: number | null;
    adjusted_due_date: string | null;
    fee_amount: number;
    interest_amount: number;
    iof_amount: number;
    other_cost_amount: number;
    total_cost_amount: number;
    created_at: string;
}

export interface EligibleInstallment {
    id: string;
    ar_title_id: string;
    installment_number: number;
    due_date: string;
    amount_open: number;
    status: "OPEN" | "PARTIAL" | "OVERDUE" | "PAID" | "CANCELLED" | "SETTLED";
    factor_custody_status: "own" | "with_factor" | "repurchased";
    ar_title: {
        id: string;
        customer_id: string | null;
        sales_document_id: string | null;
        document_number: number | string | null;
    };
}

export interface FactorOperationDetailPayload {
    operation: FactorOperation;
    factor: {
        id: string;
        name: string;
        organization_id: string | null;
        default_interest_rate: number;
        default_fee_rate: number;
        default_iof_rate: number;
        default_other_cost_rate: number;
        default_grace_days: number;
    };
    items: FactorOperationItem[];
    versions: FactorOperationVersion[];
    responses: FactorOperationResponse[];
    postingPreview: {
        discountAmount: number;
        buybackAmount: number;
        factorCostsAmount: number;
    };
}
