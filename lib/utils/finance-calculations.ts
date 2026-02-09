/**
 * Pure functions for financial installment calculations
 * 
 * Business Rules:
 * - baseDate = issue date from the financial event
 * - Split amounts with cent adjustment on last installment
 * - All calculations use cents internally for precision
 */

/**
 * Computes due dates based on a base date and array of days offset
 * 
 * @param baseDate - The reference date (usually issue_date)
 * @param days - Array of day offsets [21, 28, 35] means +21d, +28d, +35d from baseDate
 * @returns Array of Date objects
 * 
 * @example
 * computeDueDates(new Date('2026-02-06'), [21, 28])
 * // Returns [Date('2026-02-27'), Date('2026-03-06')]
 */
export function computeDueDates(baseDate: Date, days: number[]): Date[] {
    return days.map(dayOffset => {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + dayOffset);
        return date;
    });
}

/**
 * Splits a total amount (in cents) into N equal parts with remainder on last
 * 
 * @param totalCents - Total amount in cents (e.g., 14400 for R$ 144.00)
 * @param n - Number of installments
 * @returns Array of amounts in cents, sum equals totalCents exactly
 * 
 * @example
 * splitAmount(10000, 3)
 * // Returns [3333, 3333, 3334] (R$ 33.33 + R$ 33.33 + R$ 33.34 = R$ 100.00)
 */
export function splitAmount(totalCents: number, n: number): number[] {
    if (n <= 0) return [];
    if (n === 1) return [totalCents];

    const baseAmount = Math.floor(totalCents / n);
    const remainder = totalCents - (baseAmount * n);

    const amounts = Array(n).fill(baseAmount);
    amounts[n - 1] += remainder; // Add remainder to last installment

    return amounts;
}

/**
 * Payment term configuration for installment calculation
 */
export interface PaymentTermConfig {
    installments_count: number;
    first_due_days: number;
    cadence_days: number;
}

/**
 * Recalculated installment structure
 */
export interface RecalculatedInstallment {
    installment_number: number;
    due_date: string; // ISO date string YYYY-MM-DD
    amount: number; // In reais (not cents)
    payment_method: string | null;
    payment_condition: string;
}

/**
 * Recalculates installments based on new payment term
 * 
 * @param totalAmount - Total amount in reais (e.g., 144.00)
 * @param baseDate - Base date for calculation (usually issue_date)
 * @param paymentTerm - Payment term configuration
 * @param paymentMethod - Payment method to apply to all installments
 * @param paymentConditionName - Name of the payment condition (e.g., "2x - 21-28")
 * @returns Array of recalculated installments
 * 
 * @example
 * recalculateInstallments(
 *   144.00,
 *   new Date('2026-02-06'),
 *   { installments_count: 3, first_due_days: 30, cadence_days: 30 },
 *   'boleto',
 *   '3x - 30-60-90'
 * )
 * // Returns 3 installments: R$ 48.00 each, due on Mar 8, Apr 7, May 7
 */
export function recalculateInstallments(
    totalAmount: number,
    baseDate: Date,
    paymentTerm: PaymentTermConfig,
    paymentMethod: string | null,
    paymentConditionName: string
): RecalculatedInstallment[] {
    const { installments_count, first_due_days, cadence_days } = paymentTerm;

    // Generate array of day offsets
    const days: number[] = [];
    for (let i = 0; i < installments_count; i++) {
        days.push(first_due_days + (i * cadence_days));
    }

    // Calculate due dates
    const dueDates = computeDueDates(baseDate, days);

    // Calculate amounts (convert to cents for precision)
    const totalCents = Math.round(totalAmount * 100);
    const amountsCents = splitAmount(totalCents, installments_count);

    // Build installments
    return amountsCents.map((amountCents, idx) => ({
        installment_number: idx + 1,
        due_date: dueDates[idx].toISOString().split('T')[0],
        amount: amountCents / 100, // Convert back to reais
        payment_method: paymentMethod,
        payment_condition: paymentConditionName
    }));
}
