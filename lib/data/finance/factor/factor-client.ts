import { z } from "zod";
import type {
    EligibleInstallment,
    FactorItemAction,
    FactorOperationDetailPayload,
    FactorOperationListItem,
    FactorOperationStatus,
    FactorResponseStatus,
} from "@/lib/data/finance/factor/types";

const uuidSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const factorOperationStatusSchema = z.enum([
    "draft",
    "sent_to_factor",
    "in_adjustment",
    "completed",
    "cancelled",
]);

const factorItemActionSchema = z.enum([
    "discount",
    "buyback",
    "due_date_change",
]);

const factorResponseStatusSchema = z.enum([
    "pending",
    "accepted",
    "rejected",
    "adjusted",
]);

const factorOptionSchema = z.object({
    id: uuidSchema,
    name: z.string(),
});

const factorOperationListItemSchema = z.object({
    id: uuidSchema,
    operation_number: z.coerce.number().int(),
    reference: z.string().nullable(),
    issue_date: dateSchema,
    gross_amount: z.coerce.number(),
    costs_amount: z.coerce.number(),
    net_amount: z.coerce.number(),
    status: factorOperationStatusSchema,
    factor: factorOptionSchema.nullable(),
});

const factorOperationSchema = z.object({
    id: uuidSchema,
    operation_number: z.coerce.number().int(),
    factor_id: uuidSchema,
    reference: z.string().nullable(),
    issue_date: dateSchema,
    expected_settlement_date: dateSchema.nullable(),
    settlement_account_id: uuidSchema.nullable(),
    status: factorOperationStatusSchema,
    gross_amount: z.coerce.number(),
    costs_amount: z.coerce.number(),
    net_amount: z.coerce.number(),
    version_counter: z.coerce.number().int(),
    current_version_id: uuidSchema.nullable(),
    notes: z.string().nullable(),
});

const factorOperationItemSchema = z.object({
    id: uuidSchema,
    line_no: z.coerce.number().int().positive(),
    action_type: factorItemActionSchema,
    ar_installment_id: uuidSchema,
    ar_title_id: uuidSchema,
    installment_number_snapshot: z.coerce.number().int().positive(),
    due_date_snapshot: dateSchema,
    amount_snapshot: z.coerce.number(),
    proposed_due_date: dateSchema.nullable(),
    buyback_settle_now: z.boolean(),
    status: factorResponseStatusSchema,
    final_amount: z.coerce.number().nullable(),
    final_due_date: dateSchema.nullable(),
    sales_document_id: uuidSchema.nullable(),
    customer_id: uuidSchema.nullable(),
    notes: z.string().nullable(),
});

const factorOperationVersionSchema = z.object({
    id: uuidSchema,
    version_number: z.coerce.number().int().positive(),
    source_status: factorOperationStatusSchema,
    total_items: z.coerce.number().int(),
    gross_amount: z.coerce.number(),
    costs_amount: z.coerce.number(),
    net_amount: z.coerce.number(),
    created_at: z.string(),
});

const factorOperationResponseSchema = z.object({
    id: uuidSchema,
    operation_item_id: uuidSchema,
    response_status: factorResponseStatusSchema,
    response_code: z.string().nullable(),
    response_message: z.string().nullable(),
    accepted_amount: z.coerce.number().nullable(),
    adjusted_amount: z.coerce.number().nullable(),
    adjusted_due_date: dateSchema.nullable(),
    fee_amount: z.coerce.number(),
    interest_amount: z.coerce.number(),
    iof_amount: z.coerce.number(),
    other_cost_amount: z.coerce.number(),
    total_cost_amount: z.coerce.number(),
    created_at: z.string(),
});

const eligibleInstallmentSchema = z.object({
    id: uuidSchema,
    ar_title_id: uuidSchema,
    installment_number: z.coerce.number().int().positive(),
    due_date: dateSchema,
    amount_open: z.coerce.number(),
    status: z.enum(["OPEN", "PARTIAL", "OVERDUE", "PAID", "CANCELLED", "SETTLED"]),
    factor_custody_status: z.enum(["own", "with_factor", "repurchased"]),
    ar_title: z.object({
        id: uuidSchema,
        customer_id: uuidSchema.nullable(),
        sales_document_id: uuidSchema.nullable(),
        document_number: z.union([z.coerce.number(), z.string()]).nullable(),
    }),
});

const factorOperationDetailSchema = z.object({
    operation: factorOperationSchema,
    factor: z.object({
        id: uuidSchema,
        name: z.string(),
        organization_id: uuidSchema.nullable(),
        default_interest_rate: z.coerce.number(),
        default_fee_rate: z.coerce.number(),
        default_iof_rate: z.coerce.number(),
        default_other_cost_rate: z.coerce.number(),
        default_grace_days: z.coerce.number().int(),
    }),
    items: z.array(factorOperationItemSchema),
    versions: z.array(factorOperationVersionSchema),
    responses: z.array(factorOperationResponseSchema),
    postingPreview: z.object({
        discountAmount: z.coerce.number(),
        buybackAmount: z.coerce.number(),
        factorCostsAmount: z.coerce.number(),
    }),
});

const apiErrorSchema = z.object({
    error: z.object({
        message: z.string(),
        code: z.string().optional(),
        details: z.unknown().optional(),
    }),
});

class FactorApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code?: string,
        public readonly details?: unknown,
    ) {
        super(message);
        this.name = "FactorApiError";
    }
}

async function parseResponseOrThrow<T>(
    response: Response,
    schema: z.ZodSchema<T>,
): Promise<T> {
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const parsedError = apiErrorSchema.safeParse(payload);
        if (parsedError.success) {
            throw new FactorApiError(
                parsedError.data.error.message,
                response.status,
                parsedError.data.error.code,
                parsedError.data.error.details,
            );
        }

        throw new FactorApiError("Erro ao processar requisição", response.status);
    }

    const envelope = z.object({ data: schema }).safeParse(payload);
    if (!envelope.success) {
        throw new FactorApiError("Resposta inválida da API", 500, "INVALID_API_RESPONSE", envelope.error.flatten());
    }

    return envelope.data.data;
}

async function requestJson<T>(
    input: string,
    init: RequestInit,
    schema: z.ZodSchema<T>,
): Promise<T> {
    const response = await fetch(input, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
        cache: "no-store",
    });

    return parseResponseOrThrow(response, schema);
}

function toOptionalNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
}

export interface ListFactorOperationsFilters {
    status?: FactorOperationStatus;
    factorId?: string;
    search?: string;
}

export async function listFactorOperations(
    filters: ListFactorOperationsFilters = {},
): Promise<FactorOperationListItem[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.factorId) params.set("factorId", filters.factorId);
    if (filters.search) params.set("search", filters.search);

    const response = await fetch(`/api/finance/factor/operations?${params.toString()}`, { cache: "no-store" });
    return parseResponseOrThrow(
        response,
        z.object({ operations: z.array(factorOperationListItemSchema) }),
    ).then((data) => data.operations);
}

export async function listFactors(): Promise<Array<{ id: string; name: string }>> {
    const response = await fetch("/api/finance/factor/factors", { cache: "no-store" });
    return parseResponseOrThrow(
        response,
        z.object({ factors: z.array(factorOptionSchema) }),
    ).then((data) => data.factors);
}

export interface CreateFactorPayload {
    name: string;
    code?: string | null;
    organizationId?: string | null;
    defaultInterestRate?: number;
    defaultFeeRate?: number;
    defaultIofRate?: number;
    defaultOtherCostRate?: number;
    defaultGraceDays?: number;
    defaultAutoSettleBuyback?: boolean;
    notes?: string | null;
}

export async function createFactor(payload: CreateFactorPayload): Promise<{ id: string; name: string }> {
    const data = await requestJson(
        "/api/finance/factor/factors",
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        z.object({ factor: factorOptionSchema }),
    );

    return data.factor;
}

export interface CreateFactorOperationPayload {
    factorId: string;
    reference?: string | null;
    issueDate?: string;
    expectedSettlementDate?: string | null;
    settlementAccountId?: string | null;
    notes?: string | null;
}

export async function createFactorOperation(payload: CreateFactorOperationPayload): Promise<{ id: string; operation_number: number }> {
    const data = await requestJson(
        "/api/finance/factor/operations",
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        z.object({
            operation: z.object({
                id: uuidSchema,
                operation_number: z.coerce.number().int(),
            }),
        }),
    );

    return data.operation;
}

export async function getFactorOperationDetail(operationId: string): Promise<FactorOperationDetailPayload> {
    const response = await fetch(`/api/finance/factor/operations/${operationId}`, { cache: "no-store" });
    return parseResponseOrThrow(
        response,
        z.object({ detail: factorOperationDetailSchema }),
    ).then((data) => data.detail);
}

export interface UpdateFactorOperationPayload {
    notes?: string | null;
    expectedSettlementDate?: string | null;
    settlementAccountId?: string | null;
}

export async function updateFactorOperation(
    operationId: string,
    payload: UpdateFactorOperationPayload,
): Promise<void> {
    await requestJson(
        `/api/finance/factor/operations/${operationId}`,
        {
            method: "PATCH",
            body: JSON.stringify(payload),
        },
        z.object({
            operation: z.object({ id: uuidSchema }),
        }),
    );
}

export interface AddFactorOperationItemPayload {
    actionType: FactorItemAction;
    installmentId: string;
    proposedDueDate?: string | null;
    buybackSettleNow?: boolean;
    notes?: string | null;
}

export async function addFactorOperationItem(
    operationId: string,
    payload: AddFactorOperationItemPayload,
): Promise<void> {
    await requestJson(
        `/api/finance/factor/operations/${operationId}/items`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        z.object({
            item: z.object({ id: uuidSchema }),
        }),
    );
}

export async function removeFactorOperationItem(operationId: string, itemId: string): Promise<void> {
    await requestJson(
        `/api/finance/factor/operations/${operationId}/items/${itemId}`,
        { method: "DELETE" },
        z.object({ success: z.boolean() }),
    );
}

export async function listOpenInstallments(search = ""): Promise<EligibleInstallment[]> {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());

    const response = await fetch(`/api/finance/factor/installments/open?${params.toString()}`, { cache: "no-store" });
    return parseResponseOrThrow(
        response,
        z.object({ installments: z.array(eligibleInstallmentSchema) }),
    ).then((data) => data.installments);
}

export async function listInstallmentsWithFactor(): Promise<EligibleInstallment[]> {
    const response = await fetch("/api/finance/factor/installments/with-factor", { cache: "no-store" });
    return parseResponseOrThrow(
        response,
        z.object({ installments: z.array(eligibleInstallmentSchema) }),
    ).then((data) => data.installments);
}

export async function createOperationVersion(operationId: string): Promise<void> {
    await requestJson(
        `/api/finance/factor/operations/${operationId}/versions`,
        { method: "POST" },
        z.object({
            operation: z.object({ id: uuidSchema }),
            version: z.object({ id: uuidSchema }),
        }),
    );
}

export async function sendOperationToFactor(operationId: string): Promise<void> {
    await requestJson(
        `/api/finance/factor/operations/${operationId}/send`,
        { method: "POST" },
        z.object({
            operation: z.object({ id: uuidSchema }),
            version: z.object({ id: uuidSchema }),
        }),
    );
}

export interface ApplyResponseInput {
    itemId: string;
    responseStatus: FactorResponseStatus;
    responseCode?: string | null;
    responseMessage?: string | null;
    acceptedAmount?: string;
    adjustedAmount?: string;
    adjustedDueDate?: string | null;
    feeAmount?: string;
    interestAmount?: string;
    iofAmount?: string;
    otherCostAmount?: string;
}

export async function applyOperationResponses(
    operationId: string,
    versionId: string,
    responses: ApplyResponseInput[],
): Promise<void> {
    const payloadResponses = responses.map((response) => ({
        itemId: response.itemId,
        responseStatus: response.responseStatus,
        responseCode: response.responseCode?.trim() || null,
        responseMessage: response.responseMessage?.trim() || null,
        acceptedAmount: toOptionalNumber(response.acceptedAmount ?? ""),
        adjustedAmount: toOptionalNumber(response.adjustedAmount ?? ""),
        adjustedDueDate: response.adjustedDueDate || null,
        feeAmount: toOptionalNumber(response.feeAmount ?? "") ?? 0,
        interestAmount: toOptionalNumber(response.interestAmount ?? "") ?? 0,
        iofAmount: toOptionalNumber(response.iofAmount ?? "") ?? 0,
        otherCostAmount: toOptionalNumber(response.otherCostAmount ?? "") ?? 0,
    }));

    await requestJson(
        `/api/finance/factor/operations/${operationId}/responses`,
        {
            method: "POST",
            body: JSON.stringify({
                versionId,
                responses: payloadResponses,
            }),
        },
        z.object({
            operation: z.object({ id: uuidSchema }),
        }),
    );
}

export async function concludeFactorOperation(
    operationId: string,
    settlementDate?: string,
    notes?: string | null,
): Promise<{ idempotent: boolean }> {
    const data = await requestJson(
        `/api/finance/factor/operations/${operationId}/conclude`,
        {
            method: "POST",
            body: JSON.stringify({
                settlementDate: settlementDate || undefined,
                notes: notes ?? null,
            }),
        },
        z.object({
            operation: z.object({ id: uuidSchema }),
            idempotent: z.boolean(),
        }),
    );

    return { idempotent: data.idempotent };
}

export async function cancelFactorOperation(operationId: string, reason: string): Promise<void> {
    await requestJson(
        `/api/finance/factor/operations/${operationId}/cancel`,
        {
            method: "POST",
            body: JSON.stringify({ reason }),
        },
        z.object({
            operation: z.object({ id: uuidSchema }),
        }),
    );
}

export async function downloadOperationPackageZip(
    operationId: string,
    bundle: "all" | "xml" | "danfe" = "all",
): Promise<Blob> {
    const response = await fetch(
        `/api/finance/factor/operations/${operationId}/downloads/package-zip?bundle=${bundle}`,
        {
            method: "POST",
            cache: "no-store",
        },
    );

    if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const parsedError = apiErrorSchema.safeParse(payload);
        if (parsedError.success) {
            throw new FactorApiError(
                parsedError.data.error.message,
                response.status,
                parsedError.data.error.code,
                parsedError.data.error.details,
            );
        }
        throw new FactorApiError("Falha ao baixar pacote da operação", response.status);
    }

    return response.blob();
}

export function getFactorApiErrorMessage(error: unknown): string {
    if (error instanceof FactorApiError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return "Erro inesperado ao processar operação de factor";
}
