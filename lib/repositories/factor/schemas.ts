import { z } from "zod";

export const factorOperationStatusSchema = z.enum([
    "draft",
    "sent_to_factor",
    "in_adjustment",
    "completed",
    "cancelled",
]);

export const factorItemActionSchema = z.enum([
    "discount",
    "buyback",
    "due_date_change",
]);

export const factorResponseStatusSchema = z.enum([
    "pending",
    "accepted",
    "rejected",
    "adjusted",
]);

export const factorCustodyStatusSchema = z.enum([
    "own",
    "with_factor",
    "repurchased",
]);

export const uuidSchema = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const factorSchema = z.object({
    id: uuidSchema,
    company_id: uuidSchema,
    organization_id: uuidSchema.nullish(),
    name: z.string(),
    code: z.string().nullish(),
    default_interest_rate: z.coerce.number(),
    default_fee_rate: z.coerce.number(),
    default_iof_rate: z.coerce.number(),
    default_other_cost_rate: z.coerce.number(),
    default_grace_days: z.coerce.number().int(),
    default_auto_settle_buyback: z.boolean(),
    is_active: z.boolean(),
    notes: z.string().nullish(),
    created_at: z.string(),
    updated_at: z.string(),
    created_by: z.string().uuid().nullish(),
});

export const factorOperationSchema = z.object({
    id: uuidSchema,
    company_id: uuidSchema,
    factor_id: uuidSchema,
    operation_number: z.coerce.number().int(),
    reference: z.string().nullish(),
    issue_date: dateSchema,
    expected_settlement_date: dateSchema.nullish(),
    settlement_account_id: uuidSchema.nullish(),
    status: factorOperationStatusSchema,
    gross_amount: z.coerce.number(),
    costs_amount: z.coerce.number(),
    net_amount: z.coerce.number(),
    version_counter: z.coerce.number().int(),
    current_version_id: uuidSchema.nullish(),
    sent_at: z.string().nullish(),
    sent_by: uuidSchema.nullish(),
    last_response_at: z.string().nullish(),
    completed_at: z.string().nullish(),
    completed_by: uuidSchema.nullish(),
    cancelled_at: z.string().nullish(),
    cancelled_by: uuidSchema.nullish(),
    cancel_reason: z.string().nullish(),
    notes: z.string().nullish(),
    created_at: z.string(),
    updated_at: z.string(),
    created_by: uuidSchema.nullish(),
});

export const factorOperationItemSchema = z.object({
    id: uuidSchema,
    company_id: uuidSchema,
    operation_id: uuidSchema,
    line_no: z.coerce.number().int().positive(),
    action_type: factorItemActionSchema,
    ar_installment_id: uuidSchema,
    ar_title_id: uuidSchema,
    sales_document_id: uuidSchema.nullish(),
    customer_id: uuidSchema.nullish(),
    installment_number_snapshot: z.coerce.number().int().positive(),
    due_date_snapshot: dateSchema,
    amount_snapshot: z.coerce.number(),
    proposed_due_date: dateSchema.nullish(),
    buyback_settle_now: z.boolean(),
    status: factorResponseStatusSchema,
    final_amount: z.coerce.number().nullish(),
    final_due_date: dateSchema.nullish(),
    notes: z.string().nullish(),
    created_at: z.string(),
    updated_at: z.string(),
    created_by: uuidSchema.nullish(),
});

export const factorOperationVersionSchema = z.object({
    id: uuidSchema,
    company_id: uuidSchema,
    operation_id: uuidSchema,
    version_number: z.coerce.number().int().positive(),
    source_status: factorOperationStatusSchema,
    total_items: z.coerce.number().int(),
    gross_amount: z.coerce.number(),
    costs_amount: z.coerce.number(),
    net_amount: z.coerce.number(),
    snapshot_json: z.record(z.string(), z.unknown()),
    package_csv_path: z.string().nullish(),
    package_zip_path: z.string().nullish(),
    package_report_path: z.string().nullish(),
    sent_at: z.string().nullish(),
    sent_by: uuidSchema.nullish(),
    created_at: z.string(),
    created_by: uuidSchema.nullish(),
});

export const factorOperationResponseSchema = z.object({
    id: uuidSchema,
    company_id: uuidSchema,
    operation_id: uuidSchema,
    version_id: uuidSchema,
    operation_item_id: uuidSchema,
    response_status: factorResponseStatusSchema,
    response_code: z.string().nullish(),
    response_message: z.string().nullish(),
    accepted_amount: z.coerce.number().nullish(),
    adjusted_amount: z.coerce.number().nullish(),
    adjusted_due_date: dateSchema.nullish(),
    fee_amount: z.coerce.number(),
    interest_amount: z.coerce.number(),
    iof_amount: z.coerce.number(),
    other_cost_amount: z.coerce.number(),
    total_cost_amount: z.coerce.number(),
    imported_at: z.string(),
    processed_by: uuidSchema.nullish(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const operationListItemSchema = factorOperationSchema.extend({
    factor: z
        .object({
            id: uuidSchema,
            name: z.string(),
        })
        .nullish(),
});

export const eligibleInstallmentSchema = z.object({
    id: uuidSchema,
    company_id: uuidSchema,
    ar_title_id: uuidSchema,
    installment_number: z.coerce.number().int().positive(),
    due_date: dateSchema,
    amount_open: z.coerce.number(),
    status: z.enum(["OPEN", "PARTIAL", "OVERDUE", "PAID", "CANCELLED", "SETTLED"]),
    factor_custody_status: factorCustodyStatusSchema.default("own"),
    factor_id: uuidSchema.nullish(),
    ar_title: z.object({
        id: uuidSchema,
        company_id: uuidSchema,
        customer_id: uuidSchema.nullish(),
        sales_document_id: uuidSchema.nullish(),
        document_number: z.union([z.coerce.number(), z.string()]).nullish(),
    }),
});

export type FactorRecord = z.infer<typeof factorSchema>;
export type FactorOperationRecord = z.infer<typeof factorOperationSchema>;
export type FactorOperationItemRecord = z.infer<typeof factorOperationItemSchema>;
export type FactorOperationVersionRecord = z.infer<typeof factorOperationVersionSchema>;
export type FactorOperationResponseRecord = z.infer<typeof factorOperationResponseSchema>;
export type OperationListItemRecord = z.infer<typeof operationListItemSchema>;
export type EligibleInstallmentRecord = z.infer<typeof eligibleInstallmentSchema>;
