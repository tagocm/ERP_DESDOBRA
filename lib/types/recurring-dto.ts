export type RecurringRuleStatus = 'ATIVO' | 'ENCERRADO' | 'RASCUNHO';
export type GenerationMode = 'AUTOMATICO' | 'MANUAL';
export type BillingPlanType = 'RECORRENTE' | 'PARCELADO';
export type AmountType = 'FIXO' | 'VARIAVEL';

export interface RecurringRuleDTO {
    id: string;
    company_id: string;
    name: string;
    partner_name: string;
    partner_id?: string | null;
    category_id: string;
    cost_center_id?: string | null;
    description?: string | null;

    // Validity
    valid_from: string; // ISO Date
    valid_to?: string | null;

    // Billing Plan
    generation_mode: GenerationMode;
    billing_plan_type?: BillingPlanType | null;
    first_due_date?: string | null;
    installments_count?: number | null;
    frequency: string;

    // Amount
    amount_type: AmountType;
    fixed_amount?: number | null;
    estimated_amount?: number | null;

    status: RecurringRuleStatus;
    created_at: string;
    updated_at: string;

    // Legacy fields (optional for compatibility during migration)
    rule_type?: AmountType;
    due_day?: number;
    start_month?: string;
    end_month?: string | null;
    amount?: number;
    auto_generate?: boolean;
}
