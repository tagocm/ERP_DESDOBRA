import { describe, expect, it } from "vitest";
import {
    canEditFactorOperation,
    validateFactorItemEligibility,
} from "@/lib/domain/factor/validations";

describe("factor validations", () => {
    it("allows edit only in draft and in_adjustment", () => {
        expect(canEditFactorOperation("draft")).toBe(true);
        expect(canEditFactorOperation("in_adjustment")).toBe(true);
        expect(canEditFactorOperation("sent_to_factor")).toBe(false);
        expect(canEditFactorOperation("completed")).toBe(false);
        expect(canEditFactorOperation("cancelled")).toBe(false);
    });

    it("validates discount item eligibility", () => {
        expect(
            validateFactorItemEligibility({
                actionType: "discount",
                installmentStatus: "OPEN",
                custodyStatus: "own",
                amountOpen: 500,
            }).ok,
        ).toBe(true);

        expect(
            validateFactorItemEligibility({
                actionType: "discount",
                installmentStatus: "PAID",
                custodyStatus: "own",
                amountOpen: 500,
            }),
        ).toEqual({
            ok: false,
            reason: "Somente parcelas em aberto podem ser descontadas",
        });
    });

    it("validates buyback item eligibility", () => {
        expect(
            validateFactorItemEligibility({
                actionType: "buyback",
                installmentStatus: "PARTIAL",
                custodyStatus: "with_factor",
                amountOpen: 100,
            }).ok,
        ).toBe(true);

        expect(
            validateFactorItemEligibility({
                actionType: "buyback",
                installmentStatus: "PARTIAL",
                custodyStatus: "own",
                amountOpen: 100,
            }),
        ).toEqual({
            ok: false,
            reason: "Recompra só é permitida para parcela em custody da factor",
        });
    });

    it("requires proposed due date for due_date_change", () => {
        expect(
            validateFactorItemEligibility({
                actionType: "due_date_change",
                installmentStatus: "OPEN",
                custodyStatus: "with_factor",
                amountOpen: 200,
                proposedDueDate: "2026-04-01",
            }).ok,
        ).toBe(true);

        expect(
            validateFactorItemEligibility({
                actionType: "due_date_change",
                installmentStatus: "OPEN",
                custodyStatus: "with_factor",
                amountOpen: 200,
                proposedDueDate: null,
            }),
        ).toEqual({
            ok: false,
            reason: "Nova data de vencimento é obrigatória",
        });
    });
});

