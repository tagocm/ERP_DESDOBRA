import { describe, expect, it } from 'vitest';
import { computeNextRevenueChildCode, extractRevenueChildSuffix } from '@/lib/finance/revenue-category-code';

describe('revenue-category code helpers', () => {
    it('extractRevenueChildSuffix should parse valid 1.1.xx codes', () => {
        expect(extractRevenueChildSuffix('1.1.01')).toBe(1);
        expect(extractRevenueChildSuffix('1.1.9')).toBe(9);
        expect(extractRevenueChildSuffix('1.1.120')).toBe(120);
    });

    it('extractRevenueChildSuffix should reject non child revenue codes', () => {
        expect(extractRevenueChildSuffix('1.2.01')).toBeNull();
        expect(extractRevenueChildSuffix('1.1')).toBeNull();
        expect(extractRevenueChildSuffix('foo')).toBeNull();
    });

    it('computeNextRevenueChildCode should advance from the greatest source', () => {
        expect(computeNextRevenueChildCode(0, 0)).toEqual({ nextSuffix: 1, code: '1.1.01' });
        expect(computeNextRevenueChildCode(7, 3)).toEqual({ nextSuffix: 8, code: '1.1.08' });
        expect(computeNextRevenueChildCode(3, 7)).toEqual({ nextSuffix: 8, code: '1.1.08' });
    });

    it('computeNextRevenueChildCode should not reuse deleted slots when persisted suffix is ahead', () => {
        // Existing max is 8 (e.g., 1.1.09 was deleted), but persisted sequence already reached 9.
        // Next must be 10, not 9.
        expect(computeNextRevenueChildCode(9, 8)).toEqual({ nextSuffix: 10, code: '1.1.10' });
    });

    it('simulates concurrent callers resolved by persisted suffix lock step', () => {
        // Tx1 acquires lock with last=0, max=0 => 1
        const tx1 = computeNextRevenueChildCode(0, 0);

        // Tx2 starts after Tx1 commit with persisted suffix updated to 1 => 2
        const tx2 = computeNextRevenueChildCode(tx1.nextSuffix, 0);

        expect(tx1.code).toBe('1.1.01');
        expect(tx2.code).toBe('1.1.02');
        expect(tx1.code).not.toBe(tx2.code);
    });
});
