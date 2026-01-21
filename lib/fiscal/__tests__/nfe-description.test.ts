import { describe, it, expect } from '@jest/globals';
import {
    buildNfeProductDescription,
    buildSalesUnitLabel,
    resolveUomAbbrev,
    type NfeDescriptionParams
} from '../nfe-description';

describe('buildNfeProductDescription', () => {
    describe('No packaging scenarios', () => {
        it('returns name only when no packaging info provided', () => {
            const result = buildNfeProductDescription({
                itemName: 'Granola Tradicional 1kg'
            });

            expect(result.xProd).toBe('Granola Tradicional 1kg');
            expect(result.infAdProd).toBeUndefined();
        });

        it('truncates very long product names', () => {
            const longName = 'A'.repeat(130);
            const result = buildNfeProductDescription({
                itemName: longName
            });

            expect(result.xProd.length).toBeLessThanOrEqual(120);
            expect(result.xProd).toMatch(/\.\.\.$/); // ends with ellipsis
        });
    });

    describe('With packaging - base format', () => {
        it('builds conversion label: NAME - UCOM FACTORxUBASE', () => {
            const result = buildNfeProductDescription({
                itemName: 'Granola Tradicional 1kg',
                salesUomAbbrev: 'CX',
                baseUomAbbrev: 'PC',
                conversionFactor: 12
            });

            expect(result.xProd).toBe('Granola Tradicional 1kg - CX 12xPC');
            expect(result.infAdProd).toBeUndefined();
        });

        it('handles decimal conversion factors', () => {
            const result = buildNfeProductDescription({
                itemName: 'Produto Teste',
                salesUomAbbrev: 'CX',
                baseUomAbbrev: 'KG',
                conversionFactor: 2.5
            });

            expect(result.xProd).toContain('CX 2.5xKG');
        });

        it('removes trailing zeros from conversion factor', () => {
            const result = buildNfeProductDescription({
                itemName: 'Produto Teste',
                salesUomAbbrev: 'CX',
                baseUomAbbrev: 'KG',
                conversionFactor: 10.0
            });

            expect(result.xProd).toContain('CX 10xKG');
            expect(result.xProd).not.toContain('10.0');
        });
    });

    describe('With packaging and quantities - full format', () => {
        it('includes equivalence when quantities provided and fits', () => {
            const result = buildNfeProductDescription({
                itemName: 'Granola Tradicional 1kg',
                salesUomAbbrev: 'CX',
                baseUomAbbrev: 'PC',
                conversionFactor: 12,
                qtySales: 5,
                qtyBase: 60
            });

            expect(result.xProd).toBe('Granola Tradicional 1kg - CX 12xPC (5 CX = 60 PC)');
            expect(result.infAdProd).toBeUndefined();
        });

        it('handles large quantities correctly', () => {
            const result = buildNfeProductDescription({
                itemName: 'Produto',
                salesUomAbbrev: 'FD',
                baseUomAbbrev: 'UN',
                conversionFactor: 100,
                qtySales: 50,
                qtyBase: 5000
            });

            expect(result.xProd).toContain('(50 FD = 5000 UN)');
        });
    });

    describe('Length overflow handling', () => {
        it('moves equivalence to infAdProd when xProd would exceed 120 chars', () => {
            const result = buildNfeProductDescription({
                itemName: 'Granola Tradicional Orgânica com Castanhas e Mel Premium Linha Especial Sabor Extra para Cliente VIP',
                salesUomAbbrev: 'CX',
                baseUomAbbrev: 'PC',
                conversionFactor: 12,
                qtySales: 5,
                qtyBase: 60
            });

            expect(result.xProd.length).toBeLessThanOrEqual(120);
            expect(result.xProd).toContain('CX 12xPC');
            expect(result.infAdProd).toBe('Equivalência: (5 CX = 60 PC)');
        });

        it('truncates base description if even base exceeds limit', () => {
            const veryLongName = 'Produto com Nome Extremamente Longo que Ultrapassa Qualquer Limite Razoável de Caracteres para Descrição de Item em Nota Fiscal Eletrônica';
            const result = buildNfeProductDescription({
                itemName: veryLongName,
                salesUomAbbrev: 'CX',
                baseUomAbbrev: 'PC',
                conversionFactor: 12
            });

            expect(result.xProd.length).toBeLessThanOrEqual(120);
            expect(result.xProd).toMatch(/\.\.\.$/);
        });
    });

    describe('Edge cases', () => {
        it('handles missing sales quantity (only conversion factor)', () => {
            const result = buildNfeProductDescription({
                itemName: 'Produto',
                salesUomAbbrev: 'CX',
                baseUomAbbrev: 'UN',
                conversionFactor: 24,
                qtySales: undefined,
                qtyBase: undefined
            });

            expect(result.xProd).toBe('Produto - CX 24xUN');
            expect(result.infAdProd).toBeUndefined();
        });

        it('handles zero quantities (edge case)', () => {
            const result = buildNfeProductDescription({
                itemName: 'Produto',
                salesUomAbbrev: 'CX',
                baseUomAbbrev: 'UN',
                conversionFactor: 10,
                qtySales: 0,
                qtyBase: 0
            });

            // Should not include equivalence for zero
            expect(result.xProd).toBe('Produto - CX 10xUN');
        });

        it('handles conversion factor of 1', () => {
            const result = buildNfeProductDescription({
                itemName: 'Produto Individual',
                salesUomAbbrev: 'UN',
                baseUomAbbrev: 'UN',
                conversionFactor: 1,
                qtySales: 10,
                qtyBase: 10
            });

            expect(result.xProd).toContain('UN 1xUN');
        });
    });
});

describe('buildSalesUnitLabel', () => {
    it('builds correct label format', () => {
        const label = buildSalesUnitLabel('CX', 12, 'PC');
        expect(label).toBe('CX 12xPC');
    });

    it('handles decimal factors', () => {
        const label = buildSalesUnitLabel('CX', 2.5, 'KG');
        expect(label).toBe('CX 2.5xKG');
    });
});

describe('resolveUomAbbrev', () => {
    it('prefers UOM from table', () => {
        const result = resolveUomAbbrev('CAIXA', 'BOX', 'CX_LEGACY');
        expect(result).toBe('CAIXA');
    });

    it('falls back to packaging type mapping', () => {
        const result = resolveUomAbbrev(null, 'BOX', 'CX_LEGACY');
        expect(result).toBe('CX');
    });

    it('maps PACK to PC', () => {
        const result = resolveUomAbbrev(null, 'PACK', null);
        expect(result).toBe('PC');
    });

    it('maps BALE to FD', () => {
        const result = resolveUomAbbrev(null, 'BALE', null);
        expect(result).toBe('FD');
    });

    it('maps PALLET to PL', () => {
        const result = resolveUomAbbrev(null, 'PALLET', null);
        expect(result).toBe('PL');
    });

    it('uses legacy UOM as final fallback', () => {
        const result = resolveUomAbbrev(null, null, 'CUSTOM');
        expect(result).toBe('CUSTOM');
    });

    it('defaults to UN when all else fails', () => {
        const result = resolveUomAbbrev(null, null, null);
        expect(result).toBe('UN');
    });

    it('handles case-insensitive packaging types', () => {
        const result = resolveUomAbbrev(null, 'box', null);
        expect(result).toBe('CX');
    });
});
