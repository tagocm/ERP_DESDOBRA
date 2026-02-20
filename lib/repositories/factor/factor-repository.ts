import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
    eligibleInstallmentSchema,
    factorOperationItemSchema,
    factorOperationResponseSchema,
    factorOperationSchema,
    factorOperationVersionSchema,
    factorSchema,
    type EligibleInstallmentRecord,
    type FactorOperationItemRecord,
    type FactorOperationRecord,
    type FactorOperationResponseRecord,
    type FactorOperationVersionRecord,
    type FactorRecord,
    type OperationListItemRecord,
    operationListItemSchema,
} from "./schemas";

function parseArray<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context: string,
): T[] {
    const parsed = z.array(schema).safeParse(data);
    if (!parsed.success) {
        throw new Error(`Invalid ${context}: ${parsed.error.message}`);
    }
    return parsed.data;
}

function parseSingle<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context: string,
): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        throw new Error(`Invalid ${context}: ${parsed.error.message}`);
    }
    return parsed.data;
}

function requireData<T>(data: T | null, errorMessage: string): T {
    if (!data) {
        throw new Error(errorMessage);
    }
    return data;
}

export interface ListOperationsFilters {
    status?: FactorOperationRecord["status"];
    factorId?: string;
    search?: string;
    limit?: number;
}

export interface CreateOperationInput {
    companyId: string;
    factorId: string;
    reference?: string | null;
    issueDate: string;
    expectedSettlementDate?: string | null;
    settlementAccountId?: string | null;
    notes?: string | null;
    userId: string;
}

export interface CreateFactorInput {
    companyId: string;
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
    userId: string;
}

export interface UpdateOperationInput {
    status?: FactorOperationRecord["status"];
    grossAmount?: number;
    costsAmount?: number;
    netAmount?: number;
    expectedSettlementDate?: string | null;
    settlementAccountId?: string | null;
    versionCounter?: number;
    currentVersionId?: string | null;
    sentAt?: string | null;
    sentBy?: string | null;
    lastResponseAt?: string | null;
    completedAt?: string | null;
    completedBy?: string | null;
    cancelledAt?: string | null;
    cancelledBy?: string | null;
    cancelReason?: string | null;
    notes?: string | null;
}

export interface CreateOperationItemInput {
    companyId: string;
    operationId: string;
    lineNo: number;
    actionType: FactorOperationItemRecord["action_type"];
    arInstallmentId: string;
    arTitleId: string;
    salesDocumentId?: string | null;
    customerId?: string | null;
    installmentNumberSnapshot: number;
    dueDateSnapshot: string;
    amountSnapshot: number;
    proposedDueDate?: string | null;
    buybackSettleNow?: boolean;
    notes?: string | null;
    userId: string;
}

export interface CreateVersionInput {
    companyId: string;
    operationId: string;
    versionNumber: number;
    sourceStatus: FactorOperationRecord["status"];
    totalItems: number;
    grossAmount: number;
    costsAmount: number;
    netAmount: number;
    snapshotJson: Record<string, unknown>;
    sentAt?: string | null;
    sentBy?: string | null;
    packageCsvPath?: string | null;
    packageZipPath?: string | null;
    packageReportPath?: string | null;
    userId: string;
}

export interface UpsertResponseInput {
    companyId: string;
    operationId: string;
    versionId: string;
    operationItemId: string;
    responseStatus: FactorOperationResponseRecord["response_status"];
    responseCode?: string | null;
    responseMessage?: string | null;
    acceptedAmount?: number | null;
    adjustedAmount?: number | null;
    adjustedDueDate?: string | null;
    feeAmount?: number;
    interestAmount?: number;
    iofAmount?: number;
    otherCostAmount?: number;
    totalCostAmount?: number;
    processedBy?: string | null;
}

export interface CreatePostingInput {
    companyId: string;
    operationId: string;
    postingType: "ar_discount_settlement" | "ap_factor_cost" | "ap_buyback" | "ap_buyback_settlement";
    postingKey: string;
    amount: number;
    arTitleId?: string | null;
    apTitleId?: string | null;
    arPaymentId?: string | null;
    apPaymentId?: string | null;
    settlementId?: string | null;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
}

export class FactorRepository {
    constructor(private readonly supabase: SupabaseClient) { }

    async createFactor(input: CreateFactorInput): Promise<FactorRecord> {
        const { data, error } = await this.supabase
            .from("factors")
            .insert({
                company_id: input.companyId,
                name: input.name,
                code: input.code ?? null,
                organization_id: input.organizationId ?? null,
                default_interest_rate: input.defaultInterestRate ?? 0,
                default_fee_rate: input.defaultFeeRate ?? 0,
                default_iof_rate: input.defaultIofRate ?? 0,
                default_other_cost_rate: input.defaultOtherCostRate ?? 0,
                default_grace_days: input.defaultGraceDays ?? 0,
                default_auto_settle_buyback: input.defaultAutoSettleBuyback ?? false,
                notes: input.notes ?? null,
                created_by: input.userId,
            })
            .select("*")
            .single();

        if (error) {
            throw new Error(`Failed to create factor: ${error.message}`);
        }

        return parseSingle(factorSchema, data, "created factor");
    }

    async listFactors(companyId: string): Promise<FactorRecord[]> {
        const { data, error } = await this.supabase
            .from("factors")
            .select("*")
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name");

        if (error) {
            throw new Error(`Failed to list factors: ${error.message}`);
        }

        return parseArray(factorSchema, data, "factors");
    }

    async getFactorById(companyId: string, factorId: string): Promise<FactorRecord> {
        const { data, error } = await this.supabase
            .from("factors")
            .select("*")
            .eq("company_id", companyId)
            .eq("id", factorId)
            .maybeSingle();

        if (error) {
            throw new Error(`Failed to load factor: ${error.message}`);
        }

        return parseSingle(
            factorSchema,
            requireData(data, "Factor not found"),
            "factor record",
        );
    }

    async listOperations(companyId: string, filters: ListOperationsFilters): Promise<OperationListItemRecord[]> {
        let query = this.supabase
            .from("factor_operations")
            .select("*, factor:factors(id,name)")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false });

        if (filters.status) {
            query = query.eq("status", filters.status);
        }

        if (filters.factorId) {
            query = query.eq("factor_id", filters.factorId);
        }

        if (filters.search && filters.search.trim().length > 0) {
            query = query.ilike("reference", `%${filters.search.trim()}%`);
        }

        if (filters.limit && filters.limit > 0) {
            query = query.limit(filters.limit);
        }

        const { data, error } = await query;
        if (error) {
            throw new Error(`Failed to list operations: ${error.message}`);
        }

        return parseArray(operationListItemSchema, data, "operation list");
    }

    async getOperationById(companyId: string, operationId: string): Promise<FactorOperationRecord> {
        const { data, error } = await this.supabase
            .from("factor_operations")
            .select("*")
            .eq("company_id", companyId)
            .eq("id", operationId)
            .maybeSingle();

        if (error) {
            throw new Error(`Failed to load operation: ${error.message}`);
        }

        return parseSingle(
            factorOperationSchema,
            requireData(data, "Operation not found"),
            "operation record",
        );
    }

    async createOperation(input: CreateOperationInput): Promise<FactorOperationRecord> {
        const { data, error } = await this.supabase
            .from("factor_operations")
            .insert({
                company_id: input.companyId,
                factor_id: input.factorId,
                reference: input.reference ?? null,
                issue_date: input.issueDate,
                expected_settlement_date: input.expectedSettlementDate ?? null,
                settlement_account_id: input.settlementAccountId ?? null,
                notes: input.notes ?? null,
                created_by: input.userId,
            })
            .select("*")
            .single();

        if (error) {
            throw new Error(`Failed to create operation: ${error.message}`);
        }

        return parseSingle(factorOperationSchema, data, "created operation");
    }

    async updateOperation(
        companyId: string,
        operationId: string,
        input: UpdateOperationInput,
    ): Promise<FactorOperationRecord> {
        const updatePayload: Record<string, unknown> = {};
        if (input.status !== undefined) updatePayload.status = input.status;
        if (input.grossAmount !== undefined) updatePayload.gross_amount = input.grossAmount;
        if (input.costsAmount !== undefined) updatePayload.costs_amount = input.costsAmount;
        if (input.netAmount !== undefined) updatePayload.net_amount = input.netAmount;
        if (input.expectedSettlementDate !== undefined) updatePayload.expected_settlement_date = input.expectedSettlementDate;
        if (input.settlementAccountId !== undefined) updatePayload.settlement_account_id = input.settlementAccountId;
        if (input.versionCounter !== undefined) updatePayload.version_counter = input.versionCounter;
        if (input.currentVersionId !== undefined) updatePayload.current_version_id = input.currentVersionId;
        if (input.sentAt !== undefined) updatePayload.sent_at = input.sentAt;
        if (input.sentBy !== undefined) updatePayload.sent_by = input.sentBy;
        if (input.lastResponseAt !== undefined) updatePayload.last_response_at = input.lastResponseAt;
        if (input.completedAt !== undefined) updatePayload.completed_at = input.completedAt;
        if (input.completedBy !== undefined) updatePayload.completed_by = input.completedBy;
        if (input.cancelledAt !== undefined) updatePayload.cancelled_at = input.cancelledAt;
        if (input.cancelledBy !== undefined) updatePayload.cancelled_by = input.cancelledBy;
        if (input.cancelReason !== undefined) updatePayload.cancel_reason = input.cancelReason;
        if (input.notes !== undefined) updatePayload.notes = input.notes;

        const { data, error } = await this.supabase
            .from("factor_operations")
            .update(updatePayload)
            .eq("company_id", companyId)
            .eq("id", operationId)
            .select("*")
            .single();

        if (error) {
            throw new Error(`Failed to update operation: ${error.message}`);
        }

        return parseSingle(factorOperationSchema, data, "updated operation");
    }

    async getNextLineNo(operationId: string): Promise<number> {
        const { data, error } = await this.supabase
            .from("factor_operation_items")
            .select("line_no")
            .eq("operation_id", operationId)
            .order("line_no", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            throw new Error(`Failed to determine line number: ${error.message}`);
        }

        if (!data?.line_no) {
            return 1;
        }

        return Number(data.line_no) + 1;
    }

    async listOperationItems(companyId: string, operationId: string): Promise<FactorOperationItemRecord[]> {
        const { data, error } = await this.supabase
            .from("factor_operation_items")
            .select("*")
            .eq("company_id", companyId)
            .eq("operation_id", operationId)
            .order("line_no", { ascending: true });

        if (error) {
            throw new Error(`Failed to list operation items: ${error.message}`);
        }

        return parseArray(factorOperationItemSchema, data, "operation items");
    }

    async createOperationItem(input: CreateOperationItemInput): Promise<FactorOperationItemRecord> {
        const { data, error } = await this.supabase
            .from("factor_operation_items")
            .insert({
                company_id: input.companyId,
                operation_id: input.operationId,
                line_no: input.lineNo,
                action_type: input.actionType,
                ar_installment_id: input.arInstallmentId,
                ar_title_id: input.arTitleId,
                sales_document_id: input.salesDocumentId ?? null,
                customer_id: input.customerId ?? null,
                installment_number_snapshot: input.installmentNumberSnapshot,
                due_date_snapshot: input.dueDateSnapshot,
                amount_snapshot: input.amountSnapshot,
                proposed_due_date: input.proposedDueDate ?? null,
                buyback_settle_now: input.buybackSettleNow ?? false,
                notes: input.notes ?? null,
                created_by: input.userId,
            })
            .select("*")
            .single();

        if (error) {
            throw new Error(`Failed to create operation item: ${error.message}`);
        }

        return parseSingle(factorOperationItemSchema, data, "created operation item");
    }

    async updateOperationItem(
        companyId: string,
        itemId: string,
        patch: Partial<Pick<FactorOperationItemRecord, "status" | "final_amount" | "final_due_date" | "notes">>,
    ): Promise<FactorOperationItemRecord> {
        const { data, error } = await this.supabase
            .from("factor_operation_items")
            .update(patch)
            .eq("company_id", companyId)
            .eq("id", itemId)
            .select("*")
            .single();

        if (error) {
            throw new Error(`Failed to update operation item: ${error.message}`);
        }

        return parseSingle(factorOperationItemSchema, data, "updated operation item");
    }

    async deleteOperationItem(companyId: string, operationId: string, itemId: string): Promise<void> {
        const { error } = await this.supabase
            .from("factor_operation_items")
            .delete()
            .eq("company_id", companyId)
            .eq("operation_id", operationId)
            .eq("id", itemId);

        if (error) {
            throw new Error(`Failed to delete operation item: ${error.message}`);
        }
    }

    async createVersion(input: CreateVersionInput): Promise<FactorOperationVersionRecord> {
        const { data, error } = await this.supabase
            .from("factor_operation_versions")
            .insert({
                company_id: input.companyId,
                operation_id: input.operationId,
                version_number: input.versionNumber,
                source_status: input.sourceStatus,
                total_items: input.totalItems,
                gross_amount: input.grossAmount,
                costs_amount: input.costsAmount,
                net_amount: input.netAmount,
                snapshot_json: input.snapshotJson,
                package_csv_path: input.packageCsvPath ?? null,
                package_zip_path: input.packageZipPath ?? null,
                package_report_path: input.packageReportPath ?? null,
                sent_at: input.sentAt ?? null,
                sent_by: input.sentBy ?? null,
                created_by: input.userId,
            })
            .select("*")
            .single();

        if (error) {
            throw new Error(`Failed to create version: ${error.message}`);
        }

        return parseSingle(factorOperationVersionSchema, data, "created version");
    }

    async listVersions(companyId: string, operationId: string): Promise<FactorOperationVersionRecord[]> {
        const { data, error } = await this.supabase
            .from("factor_operation_versions")
            .select("*")
            .eq("company_id", companyId)
            .eq("operation_id", operationId)
            .order("version_number", { ascending: false });

        if (error) {
            throw new Error(`Failed to list versions: ${error.message}`);
        }

        return parseArray(factorOperationVersionSchema, data, "versions");
    }

    async upsertResponse(input: UpsertResponseInput): Promise<FactorOperationResponseRecord> {
        const { data, error } = await this.supabase
            .from("factor_operation_responses")
            .upsert(
                {
                    company_id: input.companyId,
                    operation_id: input.operationId,
                    version_id: input.versionId,
                    operation_item_id: input.operationItemId,
                    response_status: input.responseStatus,
                    response_code: input.responseCode ?? null,
                    response_message: input.responseMessage ?? null,
                    accepted_amount: input.acceptedAmount ?? null,
                    adjusted_amount: input.adjustedAmount ?? null,
                    adjusted_due_date: input.adjustedDueDate ?? null,
                    fee_amount: input.feeAmount ?? 0,
                    interest_amount: input.interestAmount ?? 0,
                    iof_amount: input.iofAmount ?? 0,
                    other_cost_amount: input.otherCostAmount ?? 0,
                    total_cost_amount: input.totalCostAmount ?? 0,
                    processed_by: input.processedBy ?? null,
                    imported_at: new Date().toISOString(),
                },
                { onConflict: "version_id,operation_item_id" },
            )
            .select("*")
            .single();

        if (error) {
            throw new Error(`Failed to upsert response: ${error.message}`);
        }

        return parseSingle(factorOperationResponseSchema, data, "operation response");
    }

    async listResponses(companyId: string, operationId: string): Promise<FactorOperationResponseRecord[]> {
        const { data, error } = await this.supabase
            .from("factor_operation_responses")
            .select("*")
            .eq("company_id", companyId)
            .eq("operation_id", operationId)
            .order("created_at", { ascending: false });

        if (error) {
            throw new Error(`Failed to list responses: ${error.message}`);
        }

        return parseArray(factorOperationResponseSchema, data, "responses");
    }

    async createPosting(input: CreatePostingInput): Promise<void> {
        const { error } = await this.supabase
            .from("factor_operation_postings")
            .upsert(
                {
                    company_id: input.companyId,
                    operation_id: input.operationId,
                    posting_type: input.postingType,
                    posting_key: input.postingKey,
                    ar_title_id: input.arTitleId ?? null,
                    ap_title_id: input.apTitleId ?? null,
                    ar_payment_id: input.arPaymentId ?? null,
                    ap_payment_id: input.apPaymentId ?? null,
                    settlement_id: input.settlementId ?? null,
                    amount: input.amount,
                    metadata: input.metadata ?? {},
                    created_by: input.createdBy ?? null,
                },
                { onConflict: "operation_id,posting_key" },
            );

        if (error) {
            throw new Error(`Failed to register posting: ${error.message}`);
        }
    }

    async listPostings(operationId: string): Promise<Array<{ id: string; posting_key: string }>> {
        const { data, error } = await this.supabase
            .from("factor_operation_postings")
            .select("id,posting_key")
            .eq("operation_id", operationId);

        if (error) {
            throw new Error(`Failed to list postings: ${error.message}`);
        }

        return parseArray(
            z.object({ id: z.string().uuid(), posting_key: z.string() }),
            data,
            "postings",
        );
    }

    async getInstallmentById(companyId: string, installmentId: string): Promise<EligibleInstallmentRecord> {
        const { data, error } = await this.supabase
            .from("ar_installments")
            .select(
                "id,company_id,ar_title_id,installment_number,due_date,amount_open,status,factor_custody_status,factor_id,ar_title:ar_titles!inner(id,company_id,customer_id,sales_document_id,document_number)",
            )
            .eq("company_id", companyId)
            .eq("id", installmentId)
            .maybeSingle();

        if (error) {
            throw new Error(`Failed to load installment: ${error.message}`);
        }

        return parseSingle(
            eligibleInstallmentSchema,
            requireData(data, "Installment not found"),
            "installment",
        );
    }

    async listOpenInstallments(companyId: string, queryText?: string): Promise<EligibleInstallmentRecord[]> {
        let query = this.supabase
            .from("ar_installments")
            .select(
                "id,company_id,ar_title_id,installment_number,due_date,amount_open,status,factor_custody_status,factor_id,ar_title:ar_titles!inner(id,company_id,customer_id,sales_document_id,document_number)",
            )
            .eq("company_id", companyId)
            .in("status", ["OPEN", "PARTIAL", "OVERDUE"])
            .gt("amount_open", 0)
            .order("due_date", { ascending: true })
            .limit(300);

        if (queryText && queryText.trim()) {
            query = query.ilike("ar_title.document_number", `%${queryText.trim()}%`);
        }

        const { data, error } = await query;
        if (error) {
            throw new Error(`Failed to list open installments: ${error.message}`);
        }

        return parseArray(eligibleInstallmentSchema, data, "open installments");
    }

    async listInstallmentsWithFactor(companyId: string): Promise<EligibleInstallmentRecord[]> {
        const { data, error } = await this.supabase
            .from("ar_installments")
            .select(
                "id,company_id,ar_title_id,installment_number,due_date,amount_open,status,factor_custody_status,factor_id,ar_title:ar_titles!inner(id,company_id,customer_id,sales_document_id,document_number)",
            )
            .eq("company_id", companyId)
            .eq("factor_custody_status", "with_factor")
            .in("status", ["OPEN", "PARTIAL", "OVERDUE"])
            .gt("amount_open", 0)
            .order("due_date", { ascending: true })
            .limit(300);

        if (error) {
            throw new Error(`Failed to list installments with factor: ${error.message}`);
        }

        return parseArray(eligibleInstallmentSchema, data, "installments with factor");
    }

    async updateInstallment(
        companyId: string,
        installmentId: string,
        patch: Record<string, unknown>,
    ): Promise<void> {
        const { error } = await this.supabase
            .from("ar_installments")
            .update(patch)
            .eq("company_id", companyId)
            .eq("id", installmentId);

        if (error) {
            throw new Error(`Failed to update installment: ${error.message}`);
        }
    }

    async createApTitle(input: {
        companyId: string;
        supplierId: string;
        amountTotal: number;
        issueDate: string;
        documentNumber: string;
        description: string;
    }): Promise<string> {
        const { data, error } = await this.supabase
            .from("ap_titles")
            .insert({
                company_id: input.companyId,
                supplier_id: input.supplierId,
                date_issued: input.issueDate,
                amount_total: input.amountTotal,
                amount_paid: 0,
                amount_open: input.amountTotal,
                status: "OPEN",
                document_number: input.documentNumber,
                description: input.description,
            })
            .select("id")
            .single();

        if (error) {
            throw new Error(`Failed to create AP title: ${error.message}`);
        }

        const parsed = parseSingle(z.object({ id: z.string().uuid() }), data, "ap title");
        return parsed.id;
    }

    async createApInstallment(input: {
        companyId: string;
        apTitleId: string;
        amount: number;
        dueDate: string;
    }): Promise<void> {
        const { error } = await this.supabase
            .from("ap_installments")
            .insert({
                company_id: input.companyId,
                ap_title_id: input.apTitleId,
                installment_number: 1,
                due_date: input.dueDate,
                amount_original: input.amount,
                amount_paid: 0,
                amount_open: input.amount,
                status: "OPEN",
            });

        if (error) {
            throw new Error(`Failed to create AP installment: ${error.message}`);
        }
    }

    async insertAuditLog(input: {
        companyId: string;
        userId: string;
        action: string;
        entityType: string;
        entityId: string;
        details?: Record<string, unknown>;
    }): Promise<void> {
        const { error } = await this.supabase
            .from("audit_logs")
            .insert({
                company_id: input.companyId,
                user_id: input.userId,
                action: input.action,
                entity_type: input.entityType,
                entity_id: input.entityId,
                details: input.details ?? {},
            });

        if (error) {
            throw new Error(`Failed to write audit log: ${error.message}`);
        }
    }
}
