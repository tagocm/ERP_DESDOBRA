
import { describe, it, expect } from 'vitest';
import {
    computeDueDates,
    splitAmount,
    recalculateInstallments,
    PaymentTermConfig
} from '@/lib/utils/finance-calculations';

describe('Finance Domain - Installments', () => {

    describe('computeDueDates', () => {
        it('should calculate correct due dates based on offsets', () => {
            const baseDate = new Date('2024-01-01'); // Leap year
            const days = [30, 60, 90];

            const dueDates = computeDueDates(baseDate, days);

            expect(dueDates).toHaveLength(3);
            expect(dueDates[0].toISOString().split('T')[0]).toBe('2024-01-31');
            expect(dueDates[1].toISOString().split('T')[0]).toBe('2024-03-01'); // Leap year feb has 29 days
            expect(dueDates[2].toISOString().split('T')[0]).toBe('2024-03-31');
        });

        it('should handle empty days array', () => {
            const result = computeDueDates(new Date(), []);
            expect(result).toEqual([]);
        });
    });

    describe('splitAmount', () => {
        it('should split amount equally when divisible', () => {
            // 100.00 / 2 = 50.00, 50.00
            const result = splitAmount(10000, 2);
            expect(result).toEqual([5000, 5000]);
        });

        it('should add remainder to the last installment', () => {
            // 100.00 / 3 = 33.33, 33.33, 33.34
            const result = splitAmount(10000, 3);
            expect(result).toEqual([3333, 3333, 3334]);
            expect(result.reduce((a, b) => a + b, 0)).toBe(10000);
        });

        it('should handle single installment', () => {
            const result = splitAmount(5000, 1);
            expect(result).toEqual([5000]);
        });

        it('should handle zero number of installments', () => {
            const result = splitAmount(5000, 0);
            expect(result).toEqual([]);
        });
    });

    describe('recalculateInstallments', () => {
        const baseDate = new Date('2024-01-01T12:00:00Z');

        it('should correctly recalculate 3 installments with remainder', () => {
            const paymentTerm: PaymentTermConfig = {
                installments_count: 3,
                first_due_days: 30,
                cadence_days: 30
            };

            const result = recalculateInstallments(
                100.00,
                baseDate,
                paymentTerm,
                'boleto',
                '3x'
            );

            expect(result).toHaveLength(3);

            // Check Amounts
            expect(result.map(i => i.amount)).toEqual([33.33, 33.33, 33.34]);

            // Check Dates
            expect(result[0].due_date).toBe('2024-01-31');
            expect(result[1].due_date).toBe('2024-03-01'); // 30+30 = 60 days from Jan 1 (Leap year)
            expect(result[2].due_date).toBe('2024-03-31'); // 60+30 = 90 days from Jan 1

            // Check metadata
            expect(result[0].payment_method).toBe('boleto');
            expect(result[0].payment_condition).toBe('3x');
        });

        it('should handle single installment (à vista)', () => {
            const paymentTerm: PaymentTermConfig = {
                installments_count: 1,
                first_due_days: 0,
                cadence_days: 0
            };

            const result = recalculateInstallments(
                50.55,
                baseDate,
                paymentTerm,
                'pix',
                'À Vista'
            );

            expect(result).toHaveLength(1);
            expect(result[0].amount).toBe(50.55);
            expect(result[0].due_date).toBe('2024-01-01');
        });
    });
});
