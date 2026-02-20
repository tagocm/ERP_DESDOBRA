import type { SupabaseClient } from "@supabase/supabase-js";
import {
    aggregateOperationTotals,
    calculateDiscountCosts,
} from "@/lib/domain/factor/costs";
import {
    assertFactorOperationTransition,
} from "@/lib/domain/factor/state-machine";
import {
    canEditFactorOperation,
    validateFactorItemEligibility,
} from "@/lib/domain/factor/validations";
import type {
    FactorOperationItemRecord,
    FactorOperationRecord,
    FactorOperationResponseRecord,
    FactorOperationVersionRecord,
    FactorRecord,
    OperationListItemRecord,
} from "@/lib/repositories/factor/schemas";
import {
    FactorRepository,
    type ListOperationsFilters,
} from "@/lib/repositories/factor/factor-repository";
import {
    addFactorOperationItemSchema,
    applyFactorResponsesSchema,
    cancelFactorOperationSchema,
    concludeFactorOperationSchema,
    createFactorSchema,
    createFactorOperationSchema,
    updateFactorOperationSchema,
} from "./schemas";
import { z } from "zod";

type CreateFactorInput = z.infer<typeof createFactorSchema>;
type CreateFactorOperationInput = z.infer<typeof createFactorOperationSchema>;
type UpdateFactorOperationInput = z.infer<typeof updateFactorOperationSchema>;
type AddFactorOperationItemInput = z.infer<typeof addFactorOperationItemSchema>;
type ApplyFactorResponsesInput = z.infer<typeof applyFactorResponsesSchema>;
type ConcludeFactorOperationInput = z.infer<typeof concludeFactorOperationSchema>;
type CancelFactorOperationInput = z.infer<typeof cancelFactorOperationSchema>;

export type FactorServiceRepository = Pick<
    FactorRepository,
    | "createFactor"
    | "listFactors"
    | "listOperations"
    | "createOperation"
    | "getOperationById"
    | "updateOperation"
    | "getFactorById"
    | "listOperationItems"
    | "listVersions"
    | "listResponses"
    | "getInstallmentById"
    | "getNextLineNo"
    | "createOperationItem"
    | "deleteOperationItem"
    | "listOpenInstallments"
    | "listInstallmentsWithFactor"
    | "createVersion"
    | "upsertResponse"
    | "updateOperationItem"
    | "updateInstallment"
    | "createPosting"
    | "createApTitle"
    | "createApInstallment"
    | "insertAuditLog"
>;

function ensureSupabaseClient(supabase: SupabaseClient | null): SupabaseClient {
    if (!supabase) {
        throw new Error("Supabase client is required when repository is not injected");
    }
    return supabase;
}

export class FactorServiceError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = "FactorServiceError";
    }
}

function ensureDateOnly(dateValue: string | undefined | null): string {
    if (!dateValue) {
        return new Date().toISOString().slice(0, 10);
    }
    return dateValue;
}

function toIsoNow(): string {
    return new Date().toISOString();
}

function buildResponseCostTotals(response: ApplyFactorResponsesInput["responses"][number]): number {
    const feeAmount = response.feeAmount ?? 0;
    const interestAmount = response.interestAmount ?? 0;
    const iofAmount = response.iofAmount ?? 0;
    const otherCostAmount = response.otherCostAmount ?? 0;
    return Math.round((feeAmount + interestAmount + iofAmount + otherCostAmount) * 100) / 100;
}

function isActionAccepted(status: FactorOperationResponseRecord["response_status"]): boolean {
    return status === "accepted" || status === "adjusted";
}

export interface FactorOperationDetail {
    operation: FactorOperationRecord;
    factor: FactorRecord;
    items: FactorOperationItemRecord[];
    versions: FactorOperationVersionRecord[];
    responses: FactorOperationResponseRecord[];
    postingPreview: {
        discountAmount: number;
        buybackAmount: number;
        factorCostsAmount: number;
    };
}

export class FactorService {
    private readonly repository: FactorServiceRepository;

    constructor(
        supabase: SupabaseClient | null,
        private readonly companyId: string,
        private readonly userId: string,
        repository?: FactorServiceRepository,
    ) {
        this.repository = repository ?? new FactorRepository(ensureSupabaseClient(supabase));
    }

    async createFactor(input: CreateFactorInput): Promise<FactorRecord> {
        const factor = await this.repository.createFactor({
            companyId: this.companyId,
            name: input.name,
            code: input.code ?? null,
            organizationId: input.organizationId ?? null,
            defaultInterestRate: input.defaultInterestRate ?? 0,
            defaultFeeRate: input.defaultFeeRate ?? 0,
            defaultIofRate: input.defaultIofRate ?? 0,
            defaultOtherCostRate: input.defaultOtherCostRate ?? 0,
            defaultGraceDays: input.defaultGraceDays ?? 0,
            defaultAutoSettleBuyback: input.defaultAutoSettleBuyback ?? false,
            notes: input.notes ?? null,
            userId: this.userId,
        });

        await this.repository.insertAuditLog({
            companyId: this.companyId,
            userId: this.userId,
            action: "factor_created",
            entityType: "factors",
            entityId: factor.id,
            details: {
                factor_name: factor.name,
                organization_id: factor.organization_id,
            },
        });

        return factor;
    }

    async listOperations(filters: ListOperationsFilters): Promise<OperationListItemRecord[]> {
        return this.repository.listOperations(this.companyId, filters);
    }

    async listFactors(): Promise<FactorRecord[]> {
        return this.repository.listFactors(this.companyId);
    }

    async createOperation(input: CreateFactorOperationInput): Promise<FactorOperationRecord> {
        const operation = await this.repository.createOperation({
            companyId: this.companyId,
            factorId: input.factorId,
            reference: input.reference ?? null,
            issueDate: ensureDateOnly(input.issueDate),
            expectedSettlementDate: input.expectedSettlementDate ?? null,
            settlementAccountId: input.settlementAccountId ?? null,
            notes: input.notes ?? null,
            userId: this.userId,
        });

        await this.repository.insertAuditLog({
            companyId: this.companyId,
            userId: this.userId,
            action: "factor_operation_created",
            entityType: "factor_operations",
            entityId: operation.id,
            details: {
                operation_number: operation.operation_number,
                factor_id: operation.factor_id,
            },
        });

        return operation;
    }

    async updateOperation(operationId: string, input: UpdateFactorOperationInput): Promise<FactorOperationRecord> {
        const current = await this.repository.getOperationById(this.companyId, operationId);
        if (!canEditFactorOperation(current.status)) {
            throw new FactorServiceError(
                "Operação não pode ser alterada nesse status",
                "OPERATION_NOT_EDITABLE",
                409,
            );
        }

        const updated = await this.repository.updateOperation(this.companyId, operationId, {
            notes: input.notes ?? undefined,
            expectedSettlementDate: input.expectedSettlementDate ?? undefined,
            settlementAccountId: input.settlementAccountId ?? undefined,
        });

        await this.repository.insertAuditLog({
            companyId: this.companyId,
            userId: this.userId,
            action: "factor_operation_updated",
            entityType: "factor_operations",
            entityId: operationId,
            details: {
                notes: input.notes ?? null,
                expected_settlement_date: input.expectedSettlementDate ?? null,
            },
        });

        return updated;
    }

    async getOperationDetail(operationId: string): Promise<FactorOperationDetail> {
        const operation = await this.repository.getOperationById(this.companyId, operationId);
        const factor = await this.repository.getFactorById(this.companyId, operation.factor_id);
        const items = await this.repository.listOperationItems(this.companyId, operationId);
        const versions = await this.repository.listVersions(this.companyId, operationId);
        const responses = await this.repository.listResponses(this.companyId, operationId);

        const responseByItem = new Map<string, FactorOperationResponseRecord>();
        for (const response of responses) {
            if (!responseByItem.has(response.operation_item_id)) {
                responseByItem.set(response.operation_item_id, response);
            }
        }

        let discountAmount = 0;
        let buybackAmount = 0;
        let factorCostsAmount = 0;

        for (const item of items) {
            const response = responseByItem.get(item.id);
            if (!response || !isActionAccepted(response.response_status)) {
                continue;
            }

            const effectiveAmount = response.adjusted_amount
                ?? response.accepted_amount
                ?? item.final_amount
                ?? item.amount_snapshot;

            if (item.action_type === "discount") {
                discountAmount += effectiveAmount;
                factorCostsAmount += response.total_cost_amount;
            } else if (item.action_type === "buyback") {
                buybackAmount += effectiveAmount;
            }
        }

        return {
            operation,
            factor,
            items,
            versions,
            responses,
            postingPreview: {
                discountAmount: Math.round(discountAmount * 100) / 100,
                buybackAmount: Math.round(buybackAmount * 100) / 100,
                factorCostsAmount: Math.round(factorCostsAmount * 100) / 100,
            },
        };
    }

    async addOperationItem(operationId: string, input: AddFactorOperationItemInput): Promise<FactorOperationItemRecord> {
        const operation = await this.repository.getOperationById(this.companyId, operationId);
        if (!canEditFactorOperation(operation.status)) {
            throw new FactorServiceError(
                "Operação não aceita inclusão de itens nesse status",
                "OPERATION_NOT_EDITABLE",
                409,
            );
        }

        const installment = await this.repository.getInstallmentById(this.companyId, input.installmentId);
        const validation = validateFactorItemEligibility({
            actionType: input.actionType,
            installmentStatus: installment.status,
            custodyStatus: installment.factor_custody_status,
            amountOpen: installment.amount_open,
            proposedDueDate: input.proposedDueDate ?? null,
        });

        if (!validation.ok) {
            throw new FactorServiceError(
                validation.reason ?? "Item inválido para operação",
                "ITEM_NOT_ELIGIBLE",
                422,
            );
        }

        const lineNo = await this.repository.getNextLineNo(operationId);
        const created = await this.repository.createOperationItem({
            companyId: this.companyId,
            operationId,
            lineNo,
            actionType: input.actionType,
            arInstallmentId: installment.id,
            arTitleId: installment.ar_title_id,
            salesDocumentId: installment.ar_title.sales_document_id ?? null,
            customerId: installment.ar_title.customer_id ?? null,
            installmentNumberSnapshot: installment.installment_number,
            dueDateSnapshot: installment.due_date,
            amountSnapshot: installment.amount_open,
            proposedDueDate: input.proposedDueDate ?? null,
            buybackSettleNow: input.buybackSettleNow ?? false,
            notes: input.notes ?? null,
            userId: this.userId,
        });

        await this.repository.insertAuditLog({
            companyId: this.companyId,
            userId: this.userId,
            action: "factor_item_added",
            entityType: "factor_operation_items",
            entityId: created.id,
            details: {
                operation_id: operationId,
                action_type: created.action_type,
                installment_id: created.ar_installment_id,
            },
        });

        return created;
    }

    async removeOperationItem(operationId: string, itemId: string): Promise<void> {
        const operation = await this.repository.getOperationById(this.companyId, operationId);
        if (!canEditFactorOperation(operation.status)) {
            throw new FactorServiceError(
                "Operação não aceita remoção de itens nesse status",
                "OPERATION_NOT_EDITABLE",
                409,
            );
        }

        await this.repository.deleteOperationItem(this.companyId, operationId, itemId);

        await this.repository.insertAuditLog({
            companyId: this.companyId,
            userId: this.userId,
            action: "factor_item_removed",
            entityType: "factor_operation_items",
            entityId: itemId,
            details: { operation_id: operationId },
        });
    }

    async listEligibleInstallments(queryText?: string): Promise<Awaited<ReturnType<FactorRepository["listOpenInstallments"]>>> {
        return this.repository.listOpenInstallments(this.companyId, queryText);
    }

    async listInstallmentsWithFactor(): Promise<Awaited<ReturnType<FactorRepository["listInstallmentsWithFactor"]>>> {
        return this.repository.listInstallmentsWithFactor(this.companyId);
    }

    async createVersion(operationId: string): Promise<{
        operation: FactorOperationRecord;
        version: FactorOperationVersionRecord;
    }> {
        const operation = await this.repository.getOperationById(this.companyId, operationId);
        if (!canEditFactorOperation(operation.status)) {
            throw new FactorServiceError(
                "Somente operações em rascunho/ajuste podem gerar versão",
                "OPERATION_VERSION_INVALID_STATUS",
                409,
            );
        }

        const items = await this.repository.listOperationItems(this.companyId, operationId);
        if (items.length === 0) {
            throw new FactorServiceError(
                "Adicione ao menos um item antes de gerar versão",
                "OPERATION_EMPTY",
                422,
            );
        }

        const factor = await this.repository.getFactorById(this.companyId, operation.factor_id);

        let grossAmount = 0;
        let interestAmount = 0;
        let feeAmount = 0;
        let iofAmount = 0;
        let otherCostAmount = 0;

        const issueDate = new Date(operation.issue_date);
        const snapshotItems: Array<Record<string, unknown>> = [];
        for (const item of items) {
            const baseAmount = Number(item.amount_snapshot);
            grossAmount += baseAmount;

            if (item.action_type === "discount") {
                const cost = calculateDiscountCosts({
                    baseAmount,
                    issueDate,
                    dueDate: new Date(item.due_date_snapshot),
                    rates: {
                        interestRate: Number(factor.default_interest_rate),
                        feeRate: Number(factor.default_fee_rate),
                        iofRate: Number(factor.default_iof_rate),
                        otherCostRate: Number(factor.default_other_cost_rate),
                        graceDays: Number(factor.default_grace_days),
                    },
                });

                interestAmount += cost.interestAmount;
                feeAmount += cost.feeAmount;
                iofAmount += cost.iofAmount;
                otherCostAmount += cost.otherCostAmount;

                snapshotItems.push({
                    ...item,
                    estimated_costs: cost,
                });
            } else {
                snapshotItems.push({
                    ...item,
                    estimated_costs: null,
                });
            }
        }

        const totals = aggregateOperationTotals({
            grossAmount,
            interestAmount,
            feeAmount,
            iofAmount,
            otherCostAmount,
        });

        const version = await this.repository.createVersion({
            companyId: this.companyId,
            operationId,
            versionNumber: operation.version_counter + 1,
            sourceStatus: operation.status,
            totalItems: items.length,
            grossAmount: totals.grossAmount,
            costsAmount: totals.costsAmount,
            netAmount: totals.netAmount,
            snapshotJson: {
                generated_at: toIsoNow(),
                operation_id: operationId,
                operation_number: operation.operation_number,
                factor_id: factor.id,
                factor_name: factor.name,
                items: snapshotItems,
                totals,
            },
            userId: this.userId,
        });

        const updatedOperation = await this.repository.updateOperation(this.companyId, operationId, {
            versionCounter: version.version_number,
            currentVersionId: version.id,
            grossAmount: totals.grossAmount,
            costsAmount: totals.costsAmount,
            netAmount: totals.netAmount,
        });

        await this.repository.insertAuditLog({
            companyId: this.companyId,
            userId: this.userId,
            action: "factor_version_created",
            entityType: "factor_operation_versions",
            entityId: version.id,
            details: {
                operation_id: operationId,
                version_number: version.version_number,
                total_items: items.length,
            },
        });

        return { operation: updatedOperation, version };
    }

    async sendToFactor(operationId: string): Promise<{
        operation: FactorOperationRecord;
        version: FactorOperationVersionRecord;
    }> {
        const operation = await this.repository.getOperationById(this.companyId, operationId);
        const versionResult = await this.createVersion(operationId);
        const version = versionResult.version;

        assertFactorOperationTransition(operation.status, "sent_to_factor");
        const updatedOperation = await this.repository.updateOperation(this.companyId, operationId, {
            status: "sent_to_factor",
            versionCounter: version.version_number,
            currentVersionId: version.id,
            sentAt: toIsoNow(),
            sentBy: this.userId,
            grossAmount: version.gross_amount,
            costsAmount: version.costs_amount,
            netAmount: version.net_amount,
        });

        await this.repository.insertAuditLog({
            companyId: this.companyId,
            userId: this.userId,
            action: "factor_operation_sent",
            entityType: "factor_operations",
            entityId: operationId,
            details: {
                version_id: version.id,
                version_number: version.version_number,
                total_items: version.total_items,
                totals: {
                    gross_amount: version.gross_amount,
                    costs_amount: version.costs_amount,
                    net_amount: version.net_amount,
                },
            },
        });

        return { operation: updatedOperation, version };
    }

    async applyResponses(operationId: string, input: ApplyFactorResponsesInput): Promise<FactorOperationRecord> {
        const operation = await this.repository.getOperationById(this.companyId, operationId);
        if (operation.status !== "sent_to_factor" && operation.status !== "in_adjustment") {
            throw new FactorServiceError(
                "Operação não está em status de retorno",
                "OPERATION_RESPONSE_INVALID_STATUS",
                409,
            );
        }

        const versions = await this.repository.listVersions(this.companyId, operationId);
        const version = versions.find((item) => item.id === input.versionId);
        if (!version) {
            throw new FactorServiceError("Versão não encontrada para a operação", "VERSION_NOT_FOUND", 404);
        }

        const items = await this.repository.listOperationItems(this.companyId, operationId);
        const itemMap = new Map(items.map((item) => [item.id, item]));
        let hasAdjustments = false;

        for (const response of input.responses) {
            const operationItem = itemMap.get(response.itemId);
            if (!operationItem) {
                throw new FactorServiceError(
                    `Item ${response.itemId} não pertence à operação`,
                    "ITEM_NOT_IN_OPERATION",
                    422,
                );
            }

            const totalCostAmount = buildResponseCostTotals(response);
            const upserted = await this.repository.upsertResponse({
                companyId: this.companyId,
                operationId,
                versionId: input.versionId,
                operationItemId: response.itemId,
                responseStatus: response.responseStatus,
                responseCode: response.responseCode ?? null,
                responseMessage: response.responseMessage ?? null,
                acceptedAmount: response.acceptedAmount ?? null,
                adjustedAmount: response.adjustedAmount ?? null,
                adjustedDueDate: response.adjustedDueDate ?? null,
                feeAmount: response.feeAmount ?? 0,
                interestAmount: response.interestAmount ?? 0,
                iofAmount: response.iofAmount ?? 0,
                otherCostAmount: response.otherCostAmount ?? 0,
                totalCostAmount,
                processedBy: this.userId,
            });

            const itemFinalAmount = upserted.adjusted_amount
                ?? upserted.accepted_amount
                ?? operationItem.amount_snapshot;
            const itemFinalDueDate = upserted.adjusted_due_date
                ?? operationItem.proposed_due_date
                ?? operationItem.due_date_snapshot;

            await this.repository.updateOperationItem(this.companyId, operationItem.id, {
                status: upserted.response_status,
                final_amount: itemFinalAmount,
                final_due_date: itemFinalDueDate,
            });

            if (upserted.response_status === "adjusted" || upserted.response_status === "rejected") {
                hasAdjustments = true;
            }
        }

        const nextStatus = hasAdjustments ? "in_adjustment" : "sent_to_factor";
        if (operation.status !== nextStatus) {
            assertFactorOperationTransition(operation.status, nextStatus);
        }

        const updated = await this.repository.updateOperation(this.companyId, operationId, {
            status: nextStatus,
            lastResponseAt: toIsoNow(),
        });

        await this.repository.insertAuditLog({
            companyId: this.companyId,
            userId: this.userId,
            action: "factor_response_applied",
            entityType: "factor_operations",
            entityId: operationId,
            details: {
                version_id: input.versionId,
                responses: input.responses.length,
                status_after: nextStatus,
            },
        });

        return updated;
    }

    async concludeOperation(
        operationId: string,
        input: ConcludeFactorOperationInput,
    ): Promise<{ operation: FactorOperationRecord; idempotent: boolean }> {
        const operation = await this.repository.getOperationById(this.companyId, operationId);
        if (operation.status === "completed") {
            return { operation, idempotent: true };
        }

        if (operation.status !== "sent_to_factor" && operation.status !== "in_adjustment") {
            throw new FactorServiceError(
                "Somente operações enviadas/em ajuste podem ser concluídas",
                "OPERATION_CONCLUDE_INVALID_STATUS",
                409,
            );
        }

        if (!operation.current_version_id) {
            throw new FactorServiceError(
                "Operação sem versão enviada não pode ser concluída",
                "MISSING_VERSION",
                422,
            );
        }

        const factor = await this.repository.getFactorById(this.companyId, operation.factor_id);
        const items = await this.repository.listOperationItems(this.companyId, operationId);
        const responses = await this.repository.listResponses(this.companyId, operationId);

        const responseByItem = new Map<string, FactorOperationResponseRecord>();
        for (const response of responses) {
            if (!responseByItem.has(response.operation_item_id)) {
                responseByItem.set(response.operation_item_id, response);
            }
        }

        for (const item of items) {
            if (!responseByItem.has(item.id)) {
                throw new FactorServiceError(
                    "Existem itens sem retorno aplicado",
                    "MISSING_ITEM_RESPONSE",
                    422,
                );
            }
        }

        const nowIso = toIsoNow();
        let totalCosts = 0;

        for (const item of items) {
            const response = responseByItem.get(item.id);
            if (!response || !isActionAccepted(response.response_status)) {
                continue;
            }

            const effectiveAmount = response.adjusted_amount
                ?? response.accepted_amount
                ?? item.final_amount
                ?? item.amount_snapshot;

            totalCosts += response.total_cost_amount;

            if (item.action_type === "discount") {
                await this.repository.updateInstallment(this.companyId, item.ar_installment_id, {
                    factor_custody_status: "with_factor",
                    factor_id: operation.factor_id,
                    factor_operation_item_id: item.id,
                    factor_assigned_at: nowIso,
                });

                await this.repository.createPosting({
                    companyId: this.companyId,
                    operationId,
                    postingType: "ar_discount_settlement",
                    postingKey: `discount:${item.id}`,
                    amount: effectiveAmount,
                    arTitleId: item.ar_title_id,
                    metadata: {
                        operation_item_id: item.id,
                        action_type: item.action_type,
                    },
                    createdBy: this.userId,
                });
            }

            if (item.action_type === "buyback") {
                await this.repository.updateInstallment(this.companyId, item.ar_installment_id, {
                    factor_custody_status: "repurchased",
                    factor_operation_item_id: item.id,
                    factor_released_at: nowIso,
                });

                await this.repository.createPosting({
                    companyId: this.companyId,
                    operationId,
                    postingType: "ap_buyback",
                    postingKey: `buyback:${item.id}`,
                    amount: effectiveAmount,
                    arTitleId: item.ar_title_id,
                    metadata: {
                        operation_item_id: item.id,
                        settle_now: item.buyback_settle_now,
                    },
                    createdBy: this.userId,
                });
            }

            if (item.action_type === "due_date_change") {
                const effectiveDueDate = response.adjusted_due_date
                    ?? item.final_due_date
                    ?? item.proposed_due_date;
                if (!effectiveDueDate) {
                    throw new FactorServiceError(
                        "Item de alteração de vencimento sem data final",
                        "MISSING_FINAL_DUE_DATE",
                        422,
                    );
                }

                await this.repository.updateInstallment(this.companyId, item.ar_installment_id, {
                    due_date: effectiveDueDate,
                    factor_operation_item_id: item.id,
                });
            }
        }

        totalCosts = Math.round(totalCosts * 100) / 100;

        if (totalCosts > 0 && factor.organization_id) {
            const settlementDate = input.settlementDate ?? operation.issue_date;
            const apTitleId = await this.repository.createApTitle({
                companyId: this.companyId,
                supplierId: factor.organization_id,
                amountTotal: totalCosts,
                issueDate: settlementDate,
                documentNumber: `FACTOR-${operation.operation_number}`,
                description: `Custos operação factor #${operation.operation_number}`,
            });

            await this.repository.createApInstallment({
                companyId: this.companyId,
                apTitleId,
                amount: totalCosts,
                dueDate: settlementDate,
            });

            await this.repository.createPosting({
                companyId: this.companyId,
                operationId,
                postingType: "ap_factor_cost",
                postingKey: `cost:${operation.id}`,
                amount: totalCosts,
                apTitleId,
                metadata: {
                    operation_number: operation.operation_number,
                },
                createdBy: this.userId,
            });
        }

        assertFactorOperationTransition(operation.status, "completed");
        const completed = await this.repository.updateOperation(this.companyId, operationId, {
            status: "completed",
            completedAt: nowIso,
            completedBy: this.userId,
            notes: input.notes ?? operation.notes ?? null,
        });

        await this.repository.insertAuditLog({
            companyId: this.companyId,
            userId: this.userId,
            action: "factor_operation_completed",
            entityType: "factor_operations",
            entityId: operationId,
            details: {
                operation_number: operation.operation_number,
                total_costs: totalCosts,
                item_count: items.length,
            },
        });

        return { operation: completed, idempotent: false };
    }

    async cancelOperation(operationId: string, input: CancelFactorOperationInput): Promise<FactorOperationRecord> {
        const operation = await this.repository.getOperationById(this.companyId, operationId);
        assertFactorOperationTransition(operation.status, "cancelled");

        const cancelled = await this.repository.updateOperation(this.companyId, operationId, {
            status: "cancelled",
            cancelledAt: toIsoNow(),
            cancelledBy: this.userId,
            cancelReason: input.reason,
        });

        await this.repository.insertAuditLog({
            companyId: this.companyId,
            userId: this.userId,
            action: "factor_operation_cancelled",
            entityType: "factor_operations",
            entityId: operationId,
            details: { reason: input.reason },
        });

        return cancelled;
    }
}
