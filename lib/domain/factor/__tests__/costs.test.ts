import { describe, expect, it } from "vitest";
import { aggregateOperationTotals, calculateDiscountCosts } from "@/lib/domain/factor/costs";

describe("factor costs", () => {
    it("calculates costs with grace days", () => {
        const result = calculateDiscountCosts({
            baseAmount: 1000,
            issueDate: new Date("2026-02-01"),
            dueDate: new Date("2026-03-03"), // 30 days
            rates: {
                interestRate: 3,
                feeRate: 1.5,
                iofRate: 0.38,
                otherCostRate: 0.2,
                graceDays: 10,
            },
        });

        expect(result.daysToMaturity).toBe(30);
        expect(result.billableDays).toBe(20);
        expect(result.interestAmount).toBe(20);
        expect(result.feeAmount).toBe(15);
        expect(result.iofAmount).toBe(3.8);
        expect(result.otherCostAmount).toBe(2);
        expect(result.totalCostAmount).toBe(40.8);
        expect(result.netAmount).toBe(959.2);
    });

    it("does not produce negative net amount", () => {
        const result = calculateDiscountCosts({
            baseAmount: 100,
            issueDate: new Date("2026-02-01"),
            dueDate: new Date("2026-04-02"),
            rates: {
                interestRate: 60,
                feeRate: 30,
                iofRate: 10,
                otherCostRate: 10,
                graceDays: 0,
            },
        });

        expect(result.totalCostAmount).toBeGreaterThan(100);
        expect(result.netAmount).toBe(0);
    });

    it("aggregates total costs and net amount", () => {
        const result = aggregateOperationTotals({
            grossAmount: 1500,
            interestAmount: 60.15,
            feeAmount: 11,
            iofAmount: 3.25,
            otherCostAmount: 2.1,
        });

        expect(result.grossAmount).toBe(1500);
        expect(result.costsAmount).toBe(76.5);
        expect(result.netAmount).toBe(1423.5);
    });
});

