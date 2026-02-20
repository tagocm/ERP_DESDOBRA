import {
    FactorItemEligibilityInput,
    FactorItemValidationResult,
    FactorOperationStatus,
} from "./types";

const EDITABLE_STATUSES: ReadonlySet<FactorOperationStatus> = new Set([
    "draft",
    "in_adjustment",
]);

const DISCOUNT_ALLOWED_INSTALLMENT_STATUSES = new Set([
    "OPEN",
    "PARTIAL",
    "OVERDUE",
]);

export function canEditFactorOperation(status: FactorOperationStatus): boolean {
    return EDITABLE_STATUSES.has(status);
}

export function validateFactorItemEligibility(
    input: FactorItemEligibilityInput,
): FactorItemValidationResult {
    if (input.amountOpen <= 0) {
        return { ok: false, reason: "Parcela sem saldo aberto" };
    }

    if (input.actionType === "discount") {
        if (!DISCOUNT_ALLOWED_INSTALLMENT_STATUSES.has(input.installmentStatus)) {
            return {
                ok: false,
                reason: "Somente parcelas em aberto podem ser descontadas",
            };
        }

        if (input.custodyStatus !== "own") {
            return {
                ok: false,
                reason: "Parcela já está vinculada a factor",
            };
        }

        return { ok: true };
    }

    if (input.actionType === "buyback") {
        if (input.custodyStatus !== "with_factor") {
            return {
                ok: false,
                reason: "Recompra só é permitida para parcela em custody da factor",
            };
        }

        return { ok: true };
    }

    if (input.actionType === "due_date_change") {
        if (input.custodyStatus !== "with_factor") {
            return {
                ok: false,
                reason: "Alteração de vencimento exige parcela com factor",
            };
        }

        if (!input.proposedDueDate) {
            return {
                ok: false,
                reason: "Nova data de vencimento é obrigatória",
            };
        }

        return { ok: true };
    }

    return { ok: false, reason: "Tipo de ação inválido" };
}

