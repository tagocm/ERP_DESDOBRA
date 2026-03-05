import { describe, expect, it } from "vitest";

import {
    buildProductionIdempotencyKey,
    computeByproducts,
    computeConsumptionsFromBOM,
    computeExpectedOutput,
} from "@/lib/production/production-posting-service";

describe("production-posting-service calculations", () => {
    it("calcula output esperado por receitas executadas", () => {
        expect(computeExpectedOutput(7, 15)).toBe(105);
        expect(computeExpectedOutput(0, 15)).toBe(0);
    });

    it("calcula consumos proporcionais com perda por linha da BOM", () => {
        const consumptions = computeConsumptionsFromBOM(4, [
            { componentItemId: "11111111-1111-1111-1111-111111111111", qtyPerBatch: 10, lossPercent: 5 },
            { componentItemId: "22222222-2222-2222-2222-222222222222", qtyPerBatch: 2, lossPercent: 0 },
        ]);

        expect(consumptions).toHaveLength(2);
        expect(consumptions[0]?.qty).toBeCloseTo(42, 6); // 10 * 4 * 1.05
        expect(consumptions[1]?.qty).toBeCloseTo(8, 6); // 2 * 4
    });

    it("calcula co-produtos por basis PERCENT e FIXED", () => {
        const byproducts = computeByproducts(950, 7, [
            { itemId: "33333333-3333-3333-3333-333333333333", qty: 10, basis: "PERCENT" },
            { itemId: "44444444-4444-4444-4444-444444444444", qty: 1.5, basis: "FIXED" },
        ]);

        expect(byproducts).toHaveLength(2);
        expect(byproducts[0]?.qty).toBeCloseTo(95, 6); // 950 * 10%
        expect(byproducts[1]?.qty).toBeCloseTo(10.5, 6); // 1.5 * 7 receitas
    });

    it("gera idempotency key determinística para o mesmo payload", () => {
        const first = buildProductionIdempotencyKey({
            companyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            workOrderId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            occurredAtIso: "2026-03-05T15:00:00.000Z",
            producedQty: 700,
            executedBatches: 7,
            divergenceType: "PARTIAL_EXECUTION",
        });

        const second = buildProductionIdempotencyKey({
            companyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            workOrderId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            occurredAtIso: "2026-03-05T15:00:00.000Z",
            producedQty: 700,
            executedBatches: 7,
            divergenceType: "PARTIAL_EXECUTION",
        });

        const changed = buildProductionIdempotencyKey({
            companyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            workOrderId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            occurredAtIso: "2026-03-05T15:00:00.000Z",
            producedQty: 699,
            executedBatches: 7,
            divergenceType: "PARTIAL_EXECUTION",
        });

        expect(first).toHaveLength(64);
        expect(first).toBe(second);
        expect(changed).not.toBe(first);
    });
});

