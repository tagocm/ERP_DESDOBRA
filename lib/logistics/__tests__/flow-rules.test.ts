import { describe, expect, it } from 'vitest';
import { isRouteOrderEligibleForReturn, normalizeOccurrenceType } from '@/lib/logistics/flow-rules';

describe('logistics flow rules', () => {
    describe('normalizeOccurrenceType', () => {
        it('normalizes partial loaded legacy and canonical values', () => {
            expect(normalizeOccurrenceType('PARTIAL_LOADED')).toBe('PARTIAL_LOADED');
            expect(normalizeOccurrenceType('carregamento_parcial')).toBe('PARTIAL_LOADED');
        });

        it('normalizes not loaded legacy and canonical values', () => {
            expect(normalizeOccurrenceType('NOT_LOADED_TOTAL')).toBe('NOT_LOADED_TOTAL');
            expect(normalizeOccurrenceType('nao_carregamento')).toBe('NOT_LOADED_TOTAL');
        });

        it('keeps unknown values uppercase', () => {
            expect(normalizeOccurrenceType('custom_value')).toBe('CUSTOM_VALUE');
        });
    });

    describe('isRouteOrderEligibleForReturn', () => {
        it('accepts loaded and partial orders in route', () => {
            expect(isRouteOrderEligibleForReturn('loaded', 'in_route')).toBe(true);
            expect(isRouteOrderEligibleForReturn('partial', 'em_rota')).toBe(true);
        });

        it('rejects pending or not_loaded even if route is in_route', () => {
            expect(isRouteOrderEligibleForReturn('pending', 'in_route')).toBe(false);
            expect(isRouteOrderEligibleForReturn('not_loaded', 'in_route')).toBe(false);
        });

        it('rejects loaded orders that are not in_route', () => {
            expect(isRouteOrderEligibleForReturn('loaded', 'routed')).toBe(false);
            expect(isRouteOrderEligibleForReturn('loaded', 'delivered')).toBe(false);
        });
    });
});
