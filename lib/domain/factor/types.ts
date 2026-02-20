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

export type FactorCustodyStatus =
    | "own"
    | "with_factor"
    | "repurchased";

export type ArInstallmentStatus =
    | "OPEN"
    | "PARTIAL"
    | "OVERDUE"
    | "PAID"
    | "CANCELLED"
    | "SETTLED";

export interface FactorRateConfig {
    interestRate: number;
    feeRate: number;
    iofRate: number;
    otherCostRate: number;
    graceDays: number;
}

export interface DiscountCostInput {
    baseAmount: number;
    issueDate: Date;
    dueDate: Date;
    rates: FactorRateConfig;
}

export interface DiscountCostBreakdown {
    daysToMaturity: number;
    billableDays: number;
    interestAmount: number;
    feeAmount: number;
    iofAmount: number;
    otherCostAmount: number;
    totalCostAmount: number;
    netAmount: number;
}

export interface FactorItemEligibilityInput {
    actionType: FactorItemAction;
    installmentStatus: ArInstallmentStatus;
    custodyStatus: FactorCustodyStatus;
    amountOpen: number;
    proposedDueDate?: string | null;
}

export interface FactorItemValidationResult {
    ok: boolean;
    reason?: string;
}

export interface FactorTransitionValidationResult {
    ok: boolean;
    reason?: string;
}

