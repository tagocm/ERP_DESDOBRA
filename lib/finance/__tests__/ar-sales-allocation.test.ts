import { describe, expect, it } from 'vitest';
import { buildInstallmentAllocationsMatrix, type RevenueBucket } from '@/lib/finance/ar-sales-allocation';

function sum(values: number[]): number {
    return values.reduce((acc, current) => acc + current, 0);
}

describe('buildInstallmentAllocationsMatrix', () => {
    it('suporta venda com 2 categorias em 1 parcela', () => {
        const buckets: RevenueBucket[] = [
            { glAccountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', amountCents: 8200 },
            { glAccountId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', amountCents: 1800 }
        ];

        const rows = buildInstallmentAllocationsMatrix({
            installmentIds: ['unique-installment'],
            installmentAmountsCents: [10000],
            normalizedBuckets: buckets
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].allocations).toHaveLength(2);
        expect(sum(rows[0].allocations.map((allocation) => Math.round(allocation.amount * 100)))).toBe(10000);
    });

    it('distribui rateio proporcional e fecha totais por parcela e por conta', () => {
        const buckets: RevenueBucket[] = [
            { glAccountId: '11111111-1111-1111-1111-111111111111', amountCents: 7000 },
            { glAccountId: '22222222-2222-2222-2222-222222222222', amountCents: 3000 }
        ];

        const rows = buildInstallmentAllocationsMatrix({
            installmentIds: ['a', 'b'],
            installmentAmountsCents: [5000, 5000],
            normalizedBuckets: buckets
        });

        expect(rows).toHaveLength(2);
        expect(sum(rows[0].allocations.map((allocation) => Math.round(allocation.amount * 100)))).toBe(5000);
        expect(sum(rows[1].allocations.map((allocation) => Math.round(allocation.amount * 100)))).toBe(5000);

        const account1Total = rows
            .flatMap((row) => row.allocations)
            .filter((allocation) => allocation.gl_account_id === '11111111-1111-1111-1111-111111111111')
            .reduce((acc, current) => acc + Math.round(current.amount * 100), 0);
        const account2Total = rows
            .flatMap((row) => row.allocations)
            .filter((allocation) => allocation.gl_account_id === '22222222-2222-2222-2222-222222222222')
            .reduce((acc, current) => acc + Math.round(current.amount * 100), 0);

        expect(account1Total).toBe(7000);
        expect(account2Total).toBe(3000);
    });

    it('ajusta centavos na última parcela sem perder o total', () => {
        const buckets: RevenueBucket[] = [
            { glAccountId: '33333333-3333-3333-3333-333333333333', amountCents: 6667 },
            { glAccountId: '44444444-4444-4444-4444-444444444444', amountCents: 3334 }
        ];

        const rows = buildInstallmentAllocationsMatrix({
            installmentIds: ['p1', 'p2', 'p3'],
            installmentAmountsCents: [3333, 3333, 3335],
            normalizedBuckets: buckets
        });

        expect(rows).toHaveLength(3);
        expect(rows.map((row) => sum(row.allocations.map((allocation) => Math.round(allocation.amount * 100))))).toEqual([3333, 3333, 3335]);

        const allAllocations = rows.flatMap((row) => row.allocations);
        const total = sum(allAllocations.map((allocation) => Math.round(allocation.amount * 100)));
        expect(total).toBe(10001);
    });
});
