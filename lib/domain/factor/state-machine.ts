import {
    FactorOperationStatus,
    FactorTransitionValidationResult,
} from "./types";

const ALLOWED_TRANSITIONS: Record<FactorOperationStatus, ReadonlySet<FactorOperationStatus>> = {
    draft: new Set(["sent_to_factor", "cancelled"]),
    sent_to_factor: new Set(["in_adjustment", "completed", "cancelled"]),
    in_adjustment: new Set(["sent_to_factor", "completed", "cancelled"]),
    completed: new Set(),
    cancelled: new Set(),
};

export function canTransitionFactorOperation(
    current: FactorOperationStatus,
    next: FactorOperationStatus,
): boolean {
    return ALLOWED_TRANSITIONS[current].has(next);
}

export function validateFactorOperationTransition(
    current: FactorOperationStatus,
    next: FactorOperationStatus,
): FactorTransitionValidationResult {
    if (current === next) {
        return { ok: true };
    }

    if (canTransitionFactorOperation(current, next)) {
        return { ok: true };
    }

    return {
        ok: false,
        reason: `Invalid transition from ${current} to ${next}`,
    };
}

export function assertFactorOperationTransition(
    current: FactorOperationStatus,
    next: FactorOperationStatus,
): void {
    const validation = validateFactorOperationTransition(current, next);
    if (!validation.ok) {
        throw new Error(validation.reason ?? "Invalid factor status transition");
    }
}

