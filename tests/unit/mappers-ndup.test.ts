import { describe, it, expect } from 'vitest';
import { formatNDup, buildDraftFromDb } from '../../lib/fiscal/nfe/offline/mappers';

describe('formatNDup', () => {
    it('should format 0 as "00"', () => {
        expect(formatNDup(0)).toBe('00');
    });

    it('should format 1 as "01"', () => {
        expect(formatNDup(1)).toBe('01');
    });

    it('should format 10 as "10"', () => {
        expect(formatNDup(10)).toBe('10');
    });

    it('should throw explicit error for negative numbers', () => {
        expect(() => formatNDup(-1)).toThrow(/número de parcela \(nDup\) inválido/i);
    });

    it('should throw explicit error for non-integers', () => {
        expect(() => formatNDup(1.5)).toThrow(/número de parcela \(nDup\) inválido/i);
    });
});

describe('nDup generation in buildDraftFromDb', () => {
    const baseCtx = {
        order: {
            client: {
                name: "Cliente Teste",
                document_number: "00000000000",
                addresses: [{ street: "Rua", number: "1", neighborhood: "Centro", city: "São Paulo", state: "SP", zip: "00000000", city_code_ibge: "3550308" }]
            },
            items: [],
            total_amount: 100,
            payments: []
        },
        company: {
            settings: { tax_regime: "simples_nacional", cnpj: "11111111111111", legal_name: "Empresa", ie: "111111" },
            addresses: [{ is_main: true, street: "Rua", number: "1", neighborhood: "Centro", city: "São Paulo", state: "SP", zip: "00000000", city_code_ibge: "3550308" }]
        },
        keyParams: {
            cNF: "12345678",
            cUF: "35",
            serie: "1",
            nNF: "5768",
            tpAmb: "2" as const
        }
    };

    it('generates 00 for single installment', () => {
        const ctx = structuredClone(baseCtx);
        ctx.order.payments = [
            { amount: 100, due_date: "2026-12-31", installment_number: 1 }
        ] as any;

        const draft = buildDraftFromDb(ctx);
        expect(draft.cobr?.dup?.[0].nDup).toBe("00");
    });

    it('generates 00 and 01 for two installments', () => {
        const ctx = structuredClone(baseCtx);
        // Using "some" future date for multiple installments logic loop
        ctx.order.payments = [
            { amount: 50, due_date: "2026-12-31", installment_number: 1 },
            { amount: 50, due_date: "2026-12-31", installment_number: 2 }
        ] as any;

        const draft = buildDraftFromDb(ctx);
        expect(draft.cobr?.dup?.map(d => d.nDup)).toEqual(["00", "01"]);
    });

    it('falls back to automatic sequence if installment_number is invalid', () => {
        const ctx = structuredClone(baseCtx);
        ctx.order.payments = [
            { amount: 50, due_date: "2026-12-31", installment_number: "invalid" },
            { amount: 50, due_date: "2026-12-31", installment_number: null }
        ] as any;

        const draft = buildDraftFromDb(ctx);
        expect(draft.cobr?.dup?.map(d => d.nDup)).toEqual(["00", "01"]);
    });
});
