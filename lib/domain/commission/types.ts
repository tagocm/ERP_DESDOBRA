/**
 * Commission Module - Type Definitions
 * 
 * RECEIPT_V1 Rule: Commission triggered by payment received (ar_payments.paid_at)
 */

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export interface CommissionCalculationInput {
    paymentAmount: number; // Base amount (valor recebido)
    commissionRate: number; // Percentage (0-100)
}

export interface CommissionCalculationResult {
    commissionAmount: number; // Rounded to 2 decimals
}

// ============================================================================
// DTOs (Serializáveis - sem métodos, apenas dados)
// ============================================================================

export interface CommissionClosingDTO {
    id: string;
    companyId: string;
    periodStart: string; // YYYY-MM-DD
    periodEnd: string; // YYYY-MM-DD
    status: 'draft' | 'closed' | 'reopened';
    commissionRate: number | null;
    notes: string | null;
    closedAt: string | null;
    closedBy: string | null;
    reopenedAt: string | null;
    reopenedBy: string | null;
    reopenReason: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CommissionLineDTO {
    id: string;
    closingId: string;
    companyId: string;
    salesRepId: string;
    salesRepName: string;
    salesDocumentId: string;
    documentNumber: number | null;
    customerId: string | null;
    customerName: string | null;
    arPaymentAllocationId: string; // NEW: FK to ar_payment_allocations
    arPaymentId: string; // Reference to payment
    paymentDate: string; // ISO timestamp (snapshot from ar_payments.paid_at)
    allocatedAmount: number; // RENAMED from paymentAmount
    commissionRate: number;
    commissionAmount: number;
    isReversal: boolean;
    createdAt: string;
}

export interface CommissionPreviewDTO {
    periodStart: string;
    periodEnd: string;
    defaultRate: number;
    lines: CommissionLineDTO[];
    summary: {
        totalPayments: number;
        totalCommission: number;
        lineCount: number;
        repCount: number;
        byRep: Array<{
            salesRepId: string;
            salesRepName: string;
            paymentCount: number;
            totalPayments: number;
            totalCommission: number;
        }>;
    };
}

export interface EligibleAllocation {
    allocationId: string; // ar_payment_allocations.id
    allocatedAmount: number; // ar_payment_allocations.amount_allocated
    paymentId: string; // ar_payments.id (for reference)
    paymentDate: string; // ar_payments.paid_at (snapshot)
    isReversal: boolean; // ar_payments.status === 'reversed'
    salesDocumentId: string;
    documentNumber: number | null;
    salesRepId: string;
    salesRepName: string;
    customerId: string | null;
    customerName: string | null;
}

// ============================================================================
// DATABASE ROW TYPES (para queries)
// ============================================================================

export interface CommissionClosingRow {
    id: string;
    company_id: string;
    period_start: string;
    period_end: string;
    status: string;
    commission_rate: number | null;
    notes: string | null;
    closed_at: string | null;
    closed_by: string | null;
    reopened_at: string | null;
    reopened_by: string | null;
    reopen_reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface CommissionLineRow {
    id: string;
    closing_id: string;
    company_id: string;
    sales_rep_id: string;
    sales_rep_name: string;
    sales_document_id: string;
    document_number: number | null;
    customer_id: string | null;
    customer_name: string | null;
    ar_payment_allocation_id: string; // NEW
    ar_payment_id: string;
    payment_date: string;
    allocated_amount: number; // RENAMED from payment_amount
    commission_rate: number;
    commission_amount: number;
    is_reversal: boolean;
    created_at: string;
}
