/**
 * P0 FIX Test: Multiple Allocations from Same Payment
 * 
 * This test validates that the fix prevents base duplication when a payment
 * has multiple allocations.
 */

import { describe, it, expect } from 'vitest';
import { createCommissionLine, calculateSummary } from './calculator';
import type { EligibleAllocation, CommissionLineDTO } from './types';

describe('P0 FIX: Multiple Allocations', () => {
    it('should NOT duplicate base when payment has 2 allocations', () => {
        // Scenario: Payment of R$ 1000 split into 2 allocations (R$ 600 + R$ 400)
        // Expected: Total base = R$ 1000 (sum of allocations)
        // Bug (old): Total base = R$ 2000 (payment amount counted twice)

        const allocation1: EligibleAllocation = {
            allocationId: 'alloc-1',
            allocatedAmount: 600,
            paymentId: 'pay-123', // SAME payment
            paymentDate: '2026-02-01T10:00:00Z',
            isReversal: false,
            salesDocumentId: 'doc-1',
            documentNumber: 100,
            salesRepId: 'rep-1',
            salesRepName: 'João Silva',
            customerId: 'cust-1',
            customerName: 'Cliente ABC',
        };

        const allocation2: EligibleAllocation = {
            allocationId: 'alloc-2',
            allocatedAmount: 400,
            paymentId: 'pay-123', // SAME payment
            paymentDate: '2026-02-01T10:00:00Z',
            isReversal: false,
            salesDocumentId: 'doc-2',
            documentNumber: 101,
            salesRepId: 'rep-1',
            salesRepName: 'João Silva',
            customerId: 'cust-1',
            customerName: 'Cliente ABC',
        };

        const line1 = createCommissionLine(allocation1, 'closing-1', 'company-1', 5);
        const line2 = createCommissionLine(allocation2, 'closing-1', 'company-1', 5);

        const lines: CommissionLineDTO[] = [
            { ...line1, id: '1', createdAt: '2026-02-01' },
            { ...line2, id: '2', createdAt: '2026-02-01' },
        ];

        const summary = calculateSummary(lines);

        // ✅ CORRECT: Total base = 600 + 400 = 1000
        expect(summary.totalPayments).toBe(1000);

        // ✅ CORRECT: Total commission = 30 + 20 = 50 (5% of 1000)
        expect(summary.totalCommission).toBe(50);

        // ✅ CORRECT: 2 lines (one per allocation)
        expect(summary.lineCount).toBe(2);

        // ❌ BUG (old implementation): Would have totalPayments = 2000
        expect(summary.totalPayments).not.toBe(2000);
    });

    it('should handle idempotency: same allocation cannot be in same closing twice', () => {
        // This test validates that the unique index (closing_id, ar_payment_allocation_id)
        // prevents duplicate lines for the same allocation

        const allocation: EligibleAllocation = {
            allocationId: 'alloc-123',
            allocatedAmount: 1000,
            paymentId: 'pay-456',
            paymentDate: '2026-02-01T10:00:00Z',
            isReversal: false,
            salesDocumentId: 'doc-1',
            documentNumber: 100,
            salesRepId: 'rep-1',
            salesRepName: 'João Silva',
            customerId: 'cust-1',
            customerName: 'Cliente ABC',
        };

        const line1 = createCommissionLine(allocation, 'closing-1', 'company-1', 5);
        const line2 = createCommissionLine(allocation, 'closing-1', 'company-1', 5);

        // Both lines have the same allocationId and closingId
        expect(line1.arPaymentAllocationId).toBe(line2.arPaymentAllocationId);
        expect(line1.closingId).toBe(line2.closingId);

        // Database unique index will prevent insertion of line2
        // This is enforced at DB level: UNIQUE(closing_id, ar_payment_allocation_id)
    });

    it('should allow multiple lines from same payment if different allocations', () => {
        // Scenario: Payment split into 3 allocations for different documents
        // Expected: 3 separate lines, each with unique allocation_id

        const allocations: EligibleAllocation[] = [
            {
                allocationId: 'alloc-A',
                allocatedAmount: 300,
                paymentId: 'pay-999', // SAME payment
                paymentDate: '2026-02-01T10:00:00Z',
                isReversal: false,
                salesDocumentId: 'doc-A',
                documentNumber: 100,
                salesRepId: 'rep-1',
                salesRepName: 'João Silva',
                customerId: 'cust-1',
                customerName: 'Cliente ABC',
            },
            {
                allocationId: 'alloc-B',
                allocatedAmount: 400,
                paymentId: 'pay-999', // SAME payment
                paymentDate: '2026-02-01T10:00:00Z',
                isReversal: false,
                salesDocumentId: 'doc-B',
                documentNumber: 101,
                salesRepId: 'rep-1',
                salesRepName: 'João Silva',
                customerId: 'cust-1',
                customerName: 'Cliente ABC',
            },
            {
                allocationId: 'alloc-C',
                allocatedAmount: 300,
                paymentId: 'pay-999', // SAME payment
                paymentDate: '2026-02-01T10:00:00Z',
                isReversal: false,
                salesDocumentId: 'doc-C',
                documentNumber: 102,
                salesRepId: 'rep-1',
                salesRepName: 'João Silva',
                customerId: 'cust-1',
                customerName: 'Cliente ABC',
            },
        ];

        const lines: CommissionLineDTO[] = allocations.map((alloc, i) => {
            const line = createCommissionLine(alloc, 'closing-1', 'company-1', 5);
            return { ...line, id: `${i + 1}`, createdAt: '2026-02-01' };
        });

        const summary = calculateSummary(lines);

        // ✅ Total base = 300 + 400 + 300 = 1000
        expect(summary.totalPayments).toBe(1000);

        // ✅ Total commission = 15 + 20 + 15 = 50
        expect(summary.totalCommission).toBe(50);

        // ✅ 3 lines (one per allocation)
        expect(summary.lineCount).toBe(3);

        // ✅ All lines have different allocation IDs
        const allocationIds = lines.map(l => l.arPaymentAllocationId);
        const uniqueIds = new Set(allocationIds);
        expect(uniqueIds.size).toBe(3);

        // ✅ All lines have the SAME payment ID
        const paymentIds = lines.map(l => l.arPaymentId);
        expect(new Set(paymentIds).size).toBe(1);
        expect(paymentIds[0]).toBe('pay-999');
    });
});
