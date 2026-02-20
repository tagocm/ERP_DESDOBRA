import {
    DiscountCostBreakdown,
    DiscountCostInput,
    FactorRateConfig,
} from "./types";

const MONEY_SCALE = 100;

function toMoney(value: number): number {
    return Math.round(value * MONEY_SCALE) / MONEY_SCALE;
}

function assertFiniteNonNegative(value: number, fieldName: string): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid ${fieldName}: expected non-negative finite number`);
    }
}

function computeDaysToMaturity(issueDate: Date, dueDate: Date): number {
    const issueMs = issueDate.getTime();
    const dueMs = dueDate.getTime();
    if (Number.isNaN(issueMs) || Number.isNaN(dueMs)) {
        throw new Error("Invalid dates for factor cost calculation");
    }

    const diffMs = dueMs - issueMs;
    const dayMs = 24 * 60 * 60 * 1000;
    return diffMs > 0 ? Math.ceil(diffMs / dayMs) : 0;
}

function normalizeRates(rates: FactorRateConfig): FactorRateConfig {
    assertFiniteNonNegative(rates.interestRate, "interestRate");
    assertFiniteNonNegative(rates.feeRate, "feeRate");
    assertFiniteNonNegative(rates.iofRate, "iofRate");
    assertFiniteNonNegative(rates.otherCostRate, "otherCostRate");
    assertFiniteNonNegative(rates.graceDays, "graceDays");
    return rates;
}

export function calculateDiscountCosts(input: DiscountCostInput): DiscountCostBreakdown {
    assertFiniteNonNegative(input.baseAmount, "baseAmount");
    const rates = normalizeRates(input.rates);

    const daysToMaturity = computeDaysToMaturity(input.issueDate, input.dueDate);
    const billableDays = Math.max(0, daysToMaturity - rates.graceDays);

    const interestAmount = toMoney(
        input.baseAmount * (rates.interestRate / 100) * (billableDays / 30),
    );
    const feeAmount = toMoney(input.baseAmount * (rates.feeRate / 100));
    const iofAmount = toMoney(input.baseAmount * (rates.iofRate / 100));
    const otherCostAmount = toMoney(input.baseAmount * (rates.otherCostRate / 100));
    const totalCostAmount = toMoney(
        interestAmount + feeAmount + iofAmount + otherCostAmount,
    );
    const netAmount = toMoney(Math.max(0, input.baseAmount - totalCostAmount));

    return {
        daysToMaturity,
        billableDays,
        interestAmount,
        feeAmount,
        iofAmount,
        otherCostAmount,
        totalCostAmount,
        netAmount,
    };
}

export interface AggregatedCostsInput {
    grossAmount: number;
    interestAmount: number;
    feeAmount: number;
    iofAmount: number;
    otherCostAmount: number;
}

export interface AggregatedCostsResult {
    grossAmount: number;
    costsAmount: number;
    netAmount: number;
}

export function aggregateOperationTotals(
    input: AggregatedCostsInput,
): AggregatedCostsResult {
    assertFiniteNonNegative(input.grossAmount, "grossAmount");
    assertFiniteNonNegative(input.interestAmount, "interestAmount");
    assertFiniteNonNegative(input.feeAmount, "feeAmount");
    assertFiniteNonNegative(input.iofAmount, "iofAmount");
    assertFiniteNonNegative(input.otherCostAmount, "otherCostAmount");

    const costsAmount = toMoney(
        input.interestAmount +
        input.feeAmount +
        input.iofAmount +
        input.otherCostAmount,
    );

    return {
        grossAmount: toMoney(input.grossAmount),
        costsAmount,
        netAmount: toMoney(Math.max(0, input.grossAmount - costsAmount)),
    };
}

