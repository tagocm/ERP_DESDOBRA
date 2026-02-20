import { describe, expect, it } from "vitest";
import { FactorService, type FactorServiceRepository } from "@/lib/services/factor/factor-service";
import type {
    EligibleInstallmentRecord,
    FactorOperationItemRecord,
    FactorOperationRecord,
    FactorOperationResponseRecord,
    FactorOperationVersionRecord,
    FactorRecord,
    OperationListItemRecord,
} from "@/lib/repositories/factor/schemas";
import type {
    CreateFactorInput,
    CreateOperationInput,
    CreateOperationItemInput,
    CreatePostingInput,
    CreateVersionInput,
    ListOperationsFilters,
    UpdateOperationInput,
    UpsertResponseInput,
} from "@/lib/repositories/factor/factor-repository";

const COMPANY_ID = "7310b348-5a11-4f14-bc5a-8c5a33bc6393";
const USER_ID = "15cd1234-8d7e-46f5-9f34-9fd17b638c10";
const FACTOR_ID = "f4a2c9c1-b87a-4f19-9c02-1f9688f1e3d4";
const FACTOR_ORG_ID = "b85cb2a8-7ea1-47d7-a019-216857859421";
const INSTALLMENT_ID = "1a39aef4-7060-455d-bf40-cb61d5008a2a";
const AR_TITLE_ID = "efc24852-e5cc-4233-a7f2-3de9db547a65";

class InMemoryFactorRepository implements FactorServiceRepository {
    private factors: FactorRecord[] = [];
    private operations: FactorOperationRecord[] = [];
    private items: FactorOperationItemRecord[] = [];
    private versions: FactorOperationVersionRecord[] = [];
    private responses: FactorOperationResponseRecord[] = [];
    private installments: EligibleInstallmentRecord[] = [];
    private postings: Array<{ id: string; posting_key: string }> = [];
    private apTitleCounter = 0;
    public audits: Array<{ action: string; entityType: string; entityId: string }> = [];
    public updatedInstallments: Array<{ installmentId: string; patch: Record<string, unknown> }> = [];

    constructor() {
        this.factors = [{
            id: FACTOR_ID,
            company_id: COMPANY_ID,
            organization_id: FACTOR_ORG_ID,
            name: "Factor A",
            code: "F-A",
            default_interest_rate: 2,
            default_fee_rate: 1.5,
            default_iof_rate: 0.38,
            default_other_cost_rate: 0,
            default_grace_days: 0,
            default_auto_settle_buyback: false,
            is_active: true,
            notes: null,
            created_at: "2026-02-19T12:00:00.000Z",
            updated_at: "2026-02-19T12:00:00.000Z",
            created_by: USER_ID,
        }];

        this.installments = [{
            id: INSTALLMENT_ID,
            company_id: COMPANY_ID,
            ar_title_id: AR_TITLE_ID,
            installment_number: 1,
            due_date: "2026-03-10",
            amount_open: 1000,
            status: "OPEN",
            factor_custody_status: "own",
            factor_id: null,
            ar_title: {
                id: AR_TITLE_ID,
                company_id: COMPANY_ID,
                customer_id: "8bc00f76-d96e-4bce-b0f7-cfce4d4b0521",
                sales_document_id: "2de78eab-a822-4f6a-a75c-243af9f2b8aa",
                document_number: "123",
            },
        }];
    }

    async createFactor(input: CreateFactorInput): Promise<FactorRecord> {
        const created: FactorRecord = {
            id: crypto.randomUUID(),
            company_id: input.companyId,
            organization_id: input.organizationId ?? null,
            name: input.name,
            code: input.code ?? null,
            default_interest_rate: input.defaultInterestRate ?? 0,
            default_fee_rate: input.defaultFeeRate ?? 0,
            default_iof_rate: input.defaultIofRate ?? 0,
            default_other_cost_rate: input.defaultOtherCostRate ?? 0,
            default_grace_days: input.defaultGraceDays ?? 0,
            default_auto_settle_buyback: input.defaultAutoSettleBuyback ?? false,
            is_active: true,
            notes: input.notes ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: input.userId,
        };
        this.factors.push(created);
        return created;
    }

    async listFactors(companyId: string): Promise<FactorRecord[]> {
        return this.factors.filter((factor) => factor.company_id === companyId);
    }

    async listOperations(companyId: string, _filters: ListOperationsFilters): Promise<OperationListItemRecord[]> {
        return this.operations
            .filter((operation) => operation.company_id === companyId)
            .map((operation) => ({
                ...operation,
                factor: this.factors.find((factor) => factor.id === operation.factor_id)
                    ? {
                        id: operation.factor_id,
                        name: this.factors.find((factor) => factor.id === operation.factor_id)?.name ?? "Factor",
                    }
                    : null,
            }));
    }

    async createOperation(input: CreateOperationInput): Promise<FactorOperationRecord> {
        const created: FactorOperationRecord = {
            id: crypto.randomUUID(),
            company_id: input.companyId,
            factor_id: input.factorId,
            operation_number: this.operations.length + 1,
            reference: input.reference ?? null,
            issue_date: input.issueDate,
            expected_settlement_date: input.expectedSettlementDate ?? null,
            settlement_account_id: input.settlementAccountId ?? null,
            status: "draft",
            gross_amount: 0,
            costs_amount: 0,
            net_amount: 0,
            version_counter: 0,
            current_version_id: null,
            sent_at: null,
            sent_by: null,
            last_response_at: null,
            completed_at: null,
            completed_by: null,
            cancelled_at: null,
            cancelled_by: null,
            cancel_reason: null,
            notes: input.notes ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: input.userId,
        };
        this.operations.push(created);
        return created;
    }

    async getOperationById(companyId: string, operationId: string): Promise<FactorOperationRecord> {
        const operation = this.operations.find((item) => item.company_id === companyId && item.id === operationId);
        if (!operation) throw new Error("Operation not found");
        return operation;
    }

    async updateOperation(companyId: string, operationId: string, input: UpdateOperationInput): Promise<FactorOperationRecord> {
        const current = await this.getOperationById(companyId, operationId);
        const next: FactorOperationRecord = {
            ...current,
            status: input.status ?? current.status,
            gross_amount: input.grossAmount ?? current.gross_amount,
            costs_amount: input.costsAmount ?? current.costs_amount,
            net_amount: input.netAmount ?? current.net_amount,
            expected_settlement_date: input.expectedSettlementDate ?? current.expected_settlement_date,
            settlement_account_id: input.settlementAccountId ?? current.settlement_account_id,
            version_counter: input.versionCounter ?? current.version_counter,
            current_version_id: input.currentVersionId ?? current.current_version_id,
            sent_at: input.sentAt ?? current.sent_at,
            sent_by: input.sentBy ?? current.sent_by,
            last_response_at: input.lastResponseAt ?? current.last_response_at,
            completed_at: input.completedAt ?? current.completed_at,
            completed_by: input.completedBy ?? current.completed_by,
            cancelled_at: input.cancelledAt ?? current.cancelled_at,
            cancelled_by: input.cancelledBy ?? current.cancelled_by,
            cancel_reason: input.cancelReason ?? current.cancel_reason,
            notes: input.notes ?? current.notes,
            updated_at: new Date().toISOString(),
        };
        this.operations = this.operations.map((item) => item.id === operationId ? next : item);
        return next;
    }

    async getFactorById(companyId: string, factorId: string): Promise<FactorRecord> {
        const factor = this.factors.find((item) => item.company_id === companyId && item.id === factorId);
        if (!factor) throw new Error("Factor not found");
        return factor;
    }

    async listOperationItems(companyId: string, operationId: string): Promise<FactorOperationItemRecord[]> {
        return this.items.filter((item) => item.company_id === companyId && item.operation_id === operationId);
    }

    async listVersions(companyId: string, operationId: string): Promise<FactorOperationVersionRecord[]> {
        return this.versions.filter((item) => item.company_id === companyId && item.operation_id === operationId);
    }

    async listResponses(companyId: string, operationId: string): Promise<FactorOperationResponseRecord[]> {
        return this.responses.filter((item) => item.company_id === companyId && item.operation_id === operationId);
    }

    async getInstallmentById(companyId: string, installmentId: string): Promise<EligibleInstallmentRecord> {
        const installment = this.installments.find((item) => item.company_id === companyId && item.id === installmentId);
        if (!installment) throw new Error("Installment not found");
        return installment;
    }

    async getNextLineNo(operationId: string): Promise<number> {
        const lineNumbers = this.items
            .filter((item) => item.operation_id === operationId)
            .map((item) => item.line_no);
        if (lineNumbers.length === 0) return 1;
        return Math.max(...lineNumbers) + 1;
    }

    async createOperationItem(input: CreateOperationItemInput): Promise<FactorOperationItemRecord> {
        const created: FactorOperationItemRecord = {
            id: crypto.randomUUID(),
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
            status: "pending",
            final_amount: null,
            final_due_date: null,
            notes: input.notes ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: input.userId,
        };
        this.items.push(created);
        return created;
    }

    async deleteOperationItem(companyId: string, operationId: string, itemId: string): Promise<void> {
        this.items = this.items.filter((item) => !(item.company_id === companyId && item.operation_id === operationId && item.id === itemId));
    }

    async listOpenInstallments(_companyId: string, _queryText?: string): Promise<EligibleInstallmentRecord[]> {
        return this.installments.filter((item) => item.factor_custody_status === "own");
    }

    async listInstallmentsWithFactor(_companyId: string): Promise<EligibleInstallmentRecord[]> {
        return this.installments.filter((item) => item.factor_custody_status === "with_factor");
    }

    async createVersion(input: CreateVersionInput): Promise<FactorOperationVersionRecord> {
        const created: FactorOperationVersionRecord = {
            id: crypto.randomUUID(),
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
            created_at: new Date().toISOString(),
            created_by: input.userId,
        };
        this.versions = [created, ...this.versions];
        return created;
    }

    async upsertResponse(input: UpsertResponseInput): Promise<FactorOperationResponseRecord> {
        const existing = this.responses.find((item) => item.version_id === input.versionId && item.operation_item_id === input.operationItemId);
        const response: FactorOperationResponseRecord = {
            id: existing?.id ?? crypto.randomUUID(),
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
            imported_at: new Date().toISOString(),
            processed_by: input.processedBy ?? null,
            created_at: existing?.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        if (existing) {
            this.responses = this.responses.map((item) => item.id === existing.id ? response : item);
        } else {
            this.responses.push(response);
        }
        return response;
    }

    async updateOperationItem(
        companyId: string,
        itemId: string,
        patch: Partial<Pick<FactorOperationItemRecord, "status" | "final_amount" | "final_due_date" | "notes">>,
    ): Promise<FactorOperationItemRecord> {
        const current = this.items.find((item) => item.company_id === companyId && item.id === itemId);
        if (!current) throw new Error("Item not found");
        const next = {
            ...current,
            ...patch,
            updated_at: new Date().toISOString(),
        };
        this.items = this.items.map((item) => item.id === itemId ? next : item);
        return next;
    }

    async updateInstallment(_companyId: string, installmentId: string, patch: Record<string, unknown>): Promise<void> {
        this.updatedInstallments.push({ installmentId, patch });
        const index = this.installments.findIndex((item) => item.id === installmentId);
        if (index >= 0) {
            const current = this.installments[index];
            this.installments[index] = {
                ...current,
                factor_custody_status: patch.factor_custody_status === "with_factor"
                    ? "with_factor"
                    : patch.factor_custody_status === "repurchased"
                        ? "repurchased"
                        : current.factor_custody_status,
                due_date: typeof patch.due_date === "string" ? patch.due_date : current.due_date,
            };
        }
    }

    async createPosting(input: CreatePostingInput): Promise<void> {
        const existing = this.postings.find((item) => item.posting_key === input.postingKey);
        if (!existing) {
            this.postings.push({
                id: crypto.randomUUID(),
                posting_key: input.postingKey,
            });
        }
    }

    async createApTitle(_input: {
        companyId: string;
        supplierId: string;
        amountTotal: number;
        issueDate: string;
        documentNumber: string;
        description: string;
    }): Promise<string> {
        this.apTitleCounter += 1;
        return `ap-title-${this.apTitleCounter}`;
    }

    async createApInstallment(_input: {
        companyId: string;
        apTitleId: string;
        amount: number;
        dueDate: string;
    }): Promise<void> {
        return;
    }

    async insertAuditLog(input: {
        companyId: string;
        userId: string;
        action: string;
        entityType: string;
        entityId: string;
        details?: Record<string, unknown>;
    }): Promise<void> {
        this.audits.push({
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
        });
    }

    getPostingKeys(): string[] {
        return this.postings.map((posting) => posting.posting_key);
    }
}

describe("factor service flow integration", () => {
    it("executes create -> send -> apply return -> conclude with idempotency", async () => {
        const repository = new InMemoryFactorRepository();
        const service = new FactorService(null, COMPANY_ID, USER_ID, repository);

        const created = await service.createOperation({
            factorId: FACTOR_ID,
            reference: "OPERACAO-INT-001",
            issueDate: "2026-02-19",
        });

        const item = await service.addOperationItem(created.id, {
            actionType: "discount",
            installmentId: INSTALLMENT_ID,
        });

        const sent = await service.sendToFactor(created.id);
        expect(sent.operation.status).toBe("sent_to_factor");
        expect(sent.version.version_number).toBe(1);

        await service.applyResponses(created.id, {
            versionId: sent.version.id,
            responses: [{
                itemId: item.id,
                responseStatus: "accepted",
                acceptedAmount: 1000,
                feeAmount: 20,
                interestAmount: 10,
                iofAmount: 4,
                otherCostAmount: 0,
            }],
        });

        const concluded = await service.concludeOperation(created.id, {
            settlementDate: "2026-02-20",
        });

        expect(concluded.idempotent).toBe(false);
        expect(concluded.operation.status).toBe("completed");

        const postingKeysAfterFirstConclude = repository.getPostingKeys();
        expect(postingKeysAfterFirstConclude).toContain(`discount:${item.id}`);
        expect(postingKeysAfterFirstConclude).toContain(`cost:${created.id}`);
        expect(postingKeysAfterFirstConclude.length).toBe(2);

        const secondConclude = await service.concludeOperation(created.id, {
            settlementDate: "2026-02-20",
        });
        expect(secondConclude.idempotent).toBe(true);
        expect(repository.getPostingKeys().length).toBe(2);
    });
});
