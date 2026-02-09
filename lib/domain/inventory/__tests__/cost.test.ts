
import { describe, it, expect } from 'vitest';
import { calculateNewAverageCost } from '../cost';

describe('Inventory Domain - Cost Calculation', () => {
    describe('calculateNewAverageCost', () => {
        it('should calculate new average cost correctly', () => {
            // Start: 10 units @ R$ 10.00 = R$ 100.00
            // In: 10 units @ R$ 20.00 = R$ 200.00
            // Total: 20 units @ R$ 300.00 => R$ 15.00 avg
            const result = calculateNewAverageCost(10, 10, 10, 20);
            expect(result).toBe(15);
        });

        it('should handle zero initial stock', () => {
            // Start: 0 units
            // In: 5 units @ R$ 50.00
            // New Avg: R$ 50.00
            const result = calculateNewAverageCost(0, 0, 5, 50);
            expect(result).toBe(50);
        });

        it('should return 0 if resulting stock is zero or negative', () => {
            const result = calculateNewAverageCost(10, 10, -10, 10);
            expect(result).toBe(0);
        });

        it('should handle negative input (reversal)', () => {
            // Start: 20 units @ R$ 15.00 = R$ 300.00
            // Out (Reversal): -10 units @ R$ 20.00 (from previous purchase) = -R$ 200.00
            // Remaining: 10 units @ R$ 100.00 = R$ 10.00
            const result = calculateNewAverageCost(20, 15, -10, 20);
            expect(result).toBe(10);
        });

        it('should handle decimal precision', () => {
            // Start: 10 @ 10.3333
            // In: 5 @ 15.6666
            // Value: 103.333 + 78.333 = 181.666
            // Qty: 15
            // Avg: 12.11106... -> 12.1111
            const result = calculateNewAverageCost(10, 10.3333, 5, 15.6666);
            expect(result).toBeCloseTo(12.1111, 4);
        });
    });
});
