/**
 * Commission Calculator - Pure Functions
 * 
 * RECEIPT_V1 Rule: Commission based on payment received
 * 
 * All functions are pure (no side effects, deterministic)
 */

import type {
    CommissionCalculationInput,
    CommissionCalculationResult,
    CommissionLineDTO,
    EligibleAllocation,
} from './types';

// ============================================================================
// CORE CALCULATION
// ============================================================================

/**
 * Calculate commission amount from payment amount and rate
 * 
 * @param paymentAmount - Base amount (can be negative for reversals)
 * @param commissionRate - Percentage (0-100)
 * @returns Commission amount rounded to 2 decimals
 * 
 * @example
 * calculateCommission(1000, 5) // 50.00
 * calculateCommission(100.33, 5.5) // 5.52
 * calculateCommission(-500, 5) // -25.00 (reversal)
 */
export function calculateCommission(
    paymentAmount: number,
    commissionRate: number
): number {
    if (commissionRate < 0 || commissionRate > 100) {
        throw new Error(`Invalid commission rate: ${commissionRate}. Must be between 0 and 100.`);
    }

    const commission = (paymentAmount * commissionRate) / 100;

    // Round to 2 decimal places
    return Math.round(commission * 100) / 100;
}

/**
 * Calculate commission with input/output DTOs
 */
export function calculateCommissionFromInput(
    input: CommissionCalculationInput
): CommissionCalculationResult {
    const commissionAmount = calculateCommission(
        input.paymentAmount,
        input.commissionRate
    );

    return { commissionAmount };
}

// ============================================================================
// LINE CREATION
// ============================================================================

/**
 * Create a commission line DTO from eligible allocation
 * 
 * @param allocation - Eligible allocation data
 * @param closingId - ID of the closing period
 * @param companyId - Company ID
 * @param commissionRate - Rate to apply (from rep or default)
 * @returns Commission line DTO ready for insertion
 */
export function createCommissionLine(
    allocation: EligibleAllocation,
    closingId: string,
    companyId: string,
    commissionRate: number
): Omit<CommissionLineDTO, 'id' | 'createdAt'> {
    const commissionAmount = calculateCommission(
        allocation.allocatedAmount,
        commissionRate
    );

    return {
        closingId,
        companyId,
        salesRepId: allocation.salesRepId,
        salesRepName: allocation.salesRepName,
        salesDocumentId: allocation.salesDocumentId,
        documentNumber: allocation.documentNumber,
        customerId: allocation.customerId,
        customerName: allocation.customerName,
        arPaymentAllocationId: allocation.allocationId,
        arPaymentId: allocation.paymentId,
        paymentDate: allocation.paymentDate,
        allocatedAmount: allocation.allocatedAmount,
        commissionRate,
        commissionAmount,
        isReversal: allocation.isReversal,
    };
}

// ============================================================================
// AGGREGATION
// ============================================================================

/**
 * Group commission lines by sales rep
 */
export function groupLinesByRep(lines: CommissionLineDTO[]): Array<{
    salesRepId: string;
    salesRepName: string;
    paymentCount: number;
    totalPayments: number;
    totalCommission: number;
}> {
    const grouped = new Map<string, {
        salesRepId: string;
        salesRepName: string;
        paymentCount: number;
        totalPayments: number;
        totalCommission: number;
    }>();

    for (const line of lines) {
        const existing = grouped.get(line.salesRepId);

        if (existing) {
            existing.paymentCount += 1; // Count each allocation
            existing.totalPayments += line.allocatedAmount;
            existing.totalCommission += line.commissionAmount;
        } else {
            grouped.set(line.salesRepId, {
                salesRepId: line.salesRepId,
                salesRepName: line.salesRepName,
                paymentCount: 1,
                totalPayments: line.allocatedAmount,
                totalCommission: line.commissionAmount,
            });
        }
    }

    return Array.from(grouped.values()).sort((a, b) =>
        a.salesRepName.localeCompare(b.salesRepName)
    );
}

/**
 * Calculate summary totals from lines
 */
export function calculateSummary(lines: CommissionLineDTO[]): {
    totalPayments: number;
    totalCommission: number;
    lineCount: number;
    repCount: number;
} {
    const totalPayments = lines.reduce((sum, line) => sum + line.allocatedAmount, 0);
    const totalCommission = lines.reduce((sum, line) => sum + line.commissionAmount, 0);
    const uniqueReps = new Set(lines.map(line => line.salesRepId));

    return {
        totalPayments: Math.round(totalPayments * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        lineCount: lines.length,
        repCount: uniqueReps.size,
    };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate period dates
 */
export function validatePeriod(periodStart: string, periodEnd: string): void {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (isNaN(start.getTime())) {
        throw new Error(`Invalid period start date: ${periodStart}`);
    }

    if (isNaN(end.getTime())) {
        throw new Error(`Invalid period end date: ${periodEnd}`);
    }

    if (end <= start) {
        throw new Error(`Period end (${periodEnd}) must be after period start (${periodStart})`);
    }
}

/**
 * Check if date is within period
 */
export function isDateInPeriod(
    date: string,
    periodStart: string,
    periodEnd: string
): boolean {
    const d = new Date(date);
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    return d >= start && d <= end;
}
