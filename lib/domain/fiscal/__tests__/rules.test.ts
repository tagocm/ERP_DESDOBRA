
import { describe, it, expect } from 'vitest';
import { selectBestFiscalRule, FiscalContext } from '../rules';
import { FiscalOperationDTO } from '@/lib/data/fiscal-operations';

describe('Fiscal Domain - Rules Selection', () => {
    const baseOperation: FiscalOperationDTO = {
        id: '1',
        company_id: 'co1',
        tax_group_id: 'tg1',
        uf_origem: 'SP',
        destination_state: 'RJ',
        customer_ie_indicator: 'contributor',
        customer_is_final_consumer: false,
        operation_type: 'sales',
        cfop: '6101',
        is_active: true,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',

        // Required boolean fields (from DTO)
        st_applies: false,
        pis_applies: false,
        cofins_applies: false,
        ipi_applies: false,
        icms_show_in_xml: true,
        icms_rate_percent: 18,

        // Optional fields
        icms_cst: '00',
        ipi_cst: '50',
        pis_cst: '01',
        cofins_cst: '01'
    };

    const context: FiscalContext = {
        customerUF: 'RJ',
        customerType: 'contribuinte',
        customerIsFinalConsumer: false // Industry/Resale
    };

    it('should select specific rule over generic rule (State)', () => {
        const specificRule = { ...baseOperation, id: 'specific', destination_state: 'RJ' };
        const genericRule = { ...baseOperation, id: 'generic', destination_state: '*' };

        const result = selectBestFiscalRule([genericRule, specificRule], context);
        expect(result?.id).toBe('specific');
    });

    it('should select generic rule when specific does not match', () => {
        const otherStateRule = { ...baseOperation, id: 'other', destination_state: 'MG' };
        const genericRule = { ...baseOperation, id: 'generic', destination_state: '*' };

        const result = selectBestFiscalRule([otherStateRule, genericRule], context);
        expect(result?.id).toBe('generic');
    });

    it('should select specific rule over generic rule (Customer Type)', () => {
        // Both match state RJ
        const specificType = {
            ...baseOperation,
            id: 'specific',
            customer_ie_indicator: 'contributor'
        };
        const genericType = {
            ...baseOperation,
            id: 'generic',
            customer_ie_indicator: 'all' as any // Cast for loose testing
        };

        const result = selectBestFiscalRule([genericType, specificType], context);
        expect(result?.id).toBe('specific');
    });

    it('should return undefined if no rules match', () => {
        const missState = { ...baseOperation, destination_state: 'MG' };
        const missType = {
            ...baseOperation,
            destination_state: 'RJ',
            customer_ie_indicator: 'non_contributor' as const
        };

        // Context is RJ + contributor
        const result = selectBestFiscalRule([missState, missType], context);
        expect(result).toBeUndefined();
    });

    it('should use most recent updated_at as tie breaker', () => {
        const ruleOld = {
            ...baseOperation,
            id: 'old',
            updated_at: '2024-01-01T10:00:00Z'
        };
        const ruleNew = {
            ...baseOperation,
            id: 'new',
            updated_at: '2024-01-01T12:00:00Z' // Later time
        };

        const result = selectBestFiscalRule([ruleOld, ruleNew], context);
        expect(result?.id).toBe('new');
    });

    it('should filter out inactive rules', () => {
        const activeRule = { ...baseOperation, id: 'active', is_active: true };
        const inactiveRule = { ...baseOperation, id: 'inactive', is_active: false }; // Even if it matches perfectly

        const result = selectBestFiscalRule([activeRule, inactiveRule], context);
        expect(result?.id).toBe('active');
    });

    it('should match final consumer correctly', () => {
        const consumerContext: FiscalContext = {
            customerUF: 'RJ',
            customerType: 'nao_contribuinte',
            customerIsFinalConsumer: true
        };

        const consumerRule = {
            ...baseOperation,
            id: 'consumer',
            customer_is_final_consumer: true,
            customer_ie_indicator: 'non_contributor' as const
        };

        const businessRule = {
            ...baseOperation,
            id: 'business',
            customer_is_final_consumer: false
        };

        const result = selectBestFiscalRule([consumerRule, businessRule], consumerContext);
        expect(result?.id).toBe('consumer');
    });
});
