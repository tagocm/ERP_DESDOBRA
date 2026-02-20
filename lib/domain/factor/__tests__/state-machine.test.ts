import { describe, expect, it } from "vitest";
import {
    assertFactorOperationTransition,
    canTransitionFactorOperation,
    validateFactorOperationTransition,
} from "@/lib/domain/factor/state-machine";

describe("factor operation state machine", () => {
    it("accepts valid transition draft -> sent_to_factor", () => {
        expect(canTransitionFactorOperation("draft", "sent_to_factor")).toBe(true);
        expect(validateFactorOperationTransition("draft", "sent_to_factor")).toEqual({ ok: true });
    });

    it("accepts sent_to_factor -> in_adjustment -> sent_to_factor", () => {
        expect(canTransitionFactorOperation("sent_to_factor", "in_adjustment")).toBe(true);
        expect(canTransitionFactorOperation("in_adjustment", "sent_to_factor")).toBe(true);
    });

    it("blocks completed -> draft", () => {
        const validation = validateFactorOperationTransition("completed", "draft");
        expect(validation.ok).toBe(false);
        expect(validation.reason).toContain("Invalid transition");
        expect(() => assertFactorOperationTransition("completed", "draft")).toThrow();
    });

    it("keeps same-state transition as no-op", () => {
        expect(validateFactorOperationTransition("draft", "draft")).toEqual({ ok: true });
    });
});

