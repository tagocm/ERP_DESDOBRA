/**
 * Commission Calculator - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
    calculateCommission,
    calculateCommissionFromInput,
    createCommissionLine,
    groupLinesByRep,
    calculateSummary,
    validatePeriod,
    isDateInPeriod,
} from './calculator';
import type { EligibleAllocation, CommissionLineDTO } from './types';

describe('calculateCommission', () => {
    it('should calculate basic commission', () => {
        expect(calculateCommission(1000, 5)).toBe(50);
    });

    it('should round to 2 decimal places', () => {
        expect(calculateCommission(100.33, 5.5)).toBe(5.52);
    });

    it('should handle negative amounts (reversals)', () => {
        expect(calculateCommission(-500, 5)).toBe(-25);
    });

    it('should handle zero amount', () => {
        expect(calculateCommission(0, 5)).toBe(0);
    });

    it('should handle zero rate', () => {
        expect(calculateCommission(1000, 0)).toBe(0);
    });

    it('should throw error for invalid rate (negative)', () => {
        expect(() => calculateCommission(1000, -1)).toThrow('Invalid commission rate');
    });

    it('should throw error for invalid rate (> 100)', () => {
        expect(() => calculateCommission(1000, 101)).toThrow('Invalid commission rate');
    });

    it('should handle edge case: 100% commission', () => {
        expect(calculateCommission(1000, 100)).toBe(1000);
    });

    it('should handle small amounts with proper rounding', () => {
        expect(calculateCommission(1.23, 5)).toBe(0.06);
    });

    it('should handle rounding edge case (0.005)', () => {
        // 1 * 0.5% = 0.005 -> should round to 0.01
        expect(calculateCommission(1, 0.5)).toBe(0.01);
    });
});

describe('calculateCommissionFromInput', () => {
    it('should calculate from input DTO', () => {
        const result = calculateCommissionFromInput({
            paymentAmount: 1000,
            commissionRate: 5,
        });

        expect(result.commissionAmount).toBe(50);
    });
});

describe('createCommissionLine', () => {
    it('should create commission line from eligible allocation', () => {
        const allocation: EligibleAllocation = {
            allocationId: 'alloc-123',
            allocatedAmount: 1000,
            paymentId: 'pay-123',
            paymentDate: '2026-02-01T10:00:00Z',
            isReversal: false,
            salesDocumentId: 'doc-123',
            documentNumber: 100,
            salesRepId: 'rep-123',
            salesRepName: 'João Silva',
            customerId: 'cust-123',
            customerName: 'Cliente ABC',
        };

        const line = createCommissionLine(
            allocation,
            'closing-123',
            'company-123',
            5
        );

        expect(line).toEqual({
            closingId: 'closing-123',
            companyId: 'company-123',
            salesRepId: 'rep-123',
            salesRepName: 'João Silva',
            salesDocumentId: 'doc-123',
            documentNumber: 100,
            customerId: 'cust-123',
            customerName: 'Cliente ABC',
            arPaymentAllocationId: 'alloc-123',
            arPaymentId: 'pay-123',
            paymentDate: '2026-02-01T10:00:00Z',
            allocatedAmount: 1000,
            commissionRate: 5,
            commissionAmount: 50,
            isReversal: false,
        });
    });

    it('should handle reversal (negative commission)', () => {
        const allocation: EligibleAllocation = {
            allocationId: 'alloc-456',
            allocatedAmount: -500,
            paymentId: 'pay-456',
            paymentDate: '2026-02-01T10:00:00Z',
            isReversal: true,
            salesDocumentId: 'doc-456',
            documentNumber: 101,
            salesRepId: 'rep-123',
            salesRepName: 'João Silva',
            customerId: 'cust-123',
            customerName: 'Cliente ABC',
        };

        const line = createCommissionLine(
            allocation,
            'closing-123',
            'company-123',
            5
        );

        expect(line.commissionAmount).toBe(-25);
        expect(line.isReversal).toBe(true);
    });
});

describe('groupLinesByRep', () => {
    it('should group lines by sales rep', () => {
        const lines: CommissionLineDTO[] = [
            {
                id: '1',
                closingId: 'c1',
                companyId: 'comp1',
                salesRepId: 'rep1',
                salesRepName: 'Ana Costa',
                salesDocumentId: 'doc1',
                documentNumber: 100,
                customerId: 'cust1',
                customerName: 'Cliente A',
                arPaymentAllocationId: 'alloc1',
                arPaymentId: 'pay1',
                paymentDate: '2026-02-01',
                allocatedAmount: 1000,
                commissionRate: 5,
                commissionAmount: 50,
                isReversal: false,
                createdAt: '2026-02-01',
            },
            {
                id: '2',
                closingId: 'c1',
                companyId: 'comp1',
                salesRepId: 'rep1',
                salesRepName: 'Ana Costa',
                salesDocumentId: 'doc2',
                documentNumber: 101,
                customerId: 'cust2',
                customerName: 'Cliente B',
                arPaymentAllocationId: 'alloc2',
                arPaymentId: 'pay2',
                paymentDate: '2026-02-02',
                allocatedAmount: 2000,
                commissionRate: 5,
                commissionAmount: 100,
                isReversal: false,
                createdAt: '2026-02-02',
            },
            {
                id: '3',
                closingId: 'c1',
                companyId: 'comp1',
                salesRepId: 'rep2',
                salesRepName: 'Bruno Lima',
                salesDocumentId: 'doc3',
                documentNumber: 102,
                customerId: 'cust3',
                customerName: 'Cliente C',
                arPaymentAllocationId: 'alloc3',
                arPaymentId: 'pay3',
                paymentDate: '2026-02-03',
                allocatedAmount: 500,
                commissionRate: 5,
                commissionAmount: 25,
                isReversal: false,
                createdAt: '2026-02-03',
            },
        ];

        const grouped = groupLinesByRep(lines);

        expect(grouped).toHaveLength(2);
        expect(grouped[0]).toEqual({
            salesRepId: 'rep1',
            salesRepName: 'Ana Costa',
            paymentCount: 2,
            totalPayments: 3000,
            totalCommission: 150,
        });
        expect(grouped[1]).toEqual({
            salesRepId: 'rep2',
            salesRepName: 'Bruno Lima',
            paymentCount: 1,
            totalPayments: 500,
            totalCommission: 25,
        });
    });
});

describe('calculateSummary', () => {
    it('should calculate summary totals', () => {
        const lines: CommissionLineDTO[] = [
            {
                id: '1',
                closingId: 'c1',
                companyId: 'comp1',
                salesRepId: 'rep1',
                salesRepName: 'Ana Costa',
                salesDocumentId: 'doc1',
                documentNumber: 100,
                customerId: 'cust1',
                customerName: 'Cliente A',
                arPaymentAllocationId: 'alloc1',
                arPaymentId: 'pay1',
                paymentDate: '2026-02-01',
                allocatedAmount: 1000,
                commissionRate: 5,
                commissionAmount: 50,
                isReversal: false,
                createdAt: '2026-02-01',
            },
            {
                id: '2',
                closingId: 'c1',
                companyId: 'comp1',
                salesRepId: 'rep2',
                salesRepName: 'Bruno Lima',
                salesDocumentId: 'doc2',
                documentNumber: 101,
                customerId: 'cust2',
                customerName: 'Cliente B',
                arPaymentAllocationId: 'alloc2',
                arPaymentId: 'pay2',
                paymentDate: '2026-02-02',
                allocatedAmount: 2000,
                commissionRate: 5,
                commissionAmount: 100,
                isReversal: false,
                createdAt: '2026-02-02',
            },
        ];

        const summary = calculateSummary(lines);

        expect(summary).toEqual({
            totalPayments: 3000,
            totalCommission: 150,
            lineCount: 2,
            repCount: 2,
        });
    });
});

describe('validatePeriod', () => {
    it('should validate valid period', () => {
        expect(() => validatePeriod('2026-02-01', '2026-02-28')).not.toThrow();
    });

    it('should throw for invalid start date', () => {
        expect(() => validatePeriod('invalid', '2026-02-28')).toThrow('Invalid period start date');
    });

    it('should throw for invalid end date', () => {
        expect(() => validatePeriod('2026-02-01', 'invalid')).toThrow('Invalid period end date');
    });

    it('should throw if end is before start', () => {
        expect(() => validatePeriod('2026-02-28', '2026-02-01')).toThrow('must be after');
    });

    it('should throw if end equals start', () => {
        expect(() => validatePeriod('2026-02-01', '2026-02-01')).toThrow('must be after');
    });
});

describe('isDateInPeriod', () => {
    it('should return true for date within period', () => {
        expect(isDateInPeriod('2026-02-15', '2026-02-01', '2026-02-28')).toBe(true);
    });

    it('should return true for date on start boundary', () => {
        expect(isDateInPeriod('2026-02-01', '2026-02-01', '2026-02-28')).toBe(true);
    });

    it('should return true for date on end boundary', () => {
        expect(isDateInPeriod('2026-02-28', '2026-02-01', '2026-02-28')).toBe(true);
    });

    it('should return false for date before period', () => {
        expect(isDateInPeriod('2026-01-31', '2026-02-01', '2026-02-28')).toBe(false);
    });

    it('should return false for date after period', () => {
        expect(isDateInPeriod('2026-03-01', '2026-02-01', '2026-02-28')).toBe(false);
    });
});
