import { SupabaseClient } from '@supabase/supabase-js';
import { getFiscalOperations, FiscalOperationDTO } from './fiscal-operations';

/**
 * Fiscal Engine - Automatic Tax Rule Resolution
 * Resolves the most specific fiscal operation rule for a sales order item
 */

export interface FiscalResolutionInput {
    // Emitter (Active Company)
    companyUF: string;
    companyTaxRegime: 'simples' | 'normal';

    // Customer
    customerUF: string;
    customerType: 'contribuinte' | 'isento' | 'nao_contribuinte';
    customerIsFinalConsumer: boolean;

    // Product
    productTaxGroupId: string;
    productNCM?: string;
    productCEST?: string;
    productOrigin?: number;
}

export interface FiscalResolutionResult {
    status: 'calculated' | 'no_rule_found' | 'error';
    operation?: FiscalOperationDTO;
    cfop?: string;
    cst_icms?: string;
    csosn?: string;
    st_applies?: boolean;
    st_base_calc?: number;
    st_aliquot?: number;
    st_value?: number;
    pis_cst?: string;
    pis_aliquot?: number;
    pis_value?: number;
    cofins_cst?: string;
    cofins_aliquot?: number;
    cofins_value?: number;
    ipi_applies?: boolean;
    ipi_cst?: string;
    ipi_aliquot?: number;
    ipi_value?: number;
    fiscal_notes?: string;
    error?: string;
}

/**
 * Resolve fiscal operation for a single item
 * Priority: Most specific rule wins
 * 1. uf_origem (mandatory match)
 * 2. tax_group_id (mandatory match)
 * 3. destination_state (specific > "all")
 * 4. customer_ie_indicator (specific > "all")
 * 5. If tie, most recent (updated_at DESC)
 */
export async function resolveFiscalRule(
    supabase: SupabaseClient,
    companyId: string,
    input: FiscalResolutionInput
): Promise<FiscalResolutionResult> {
    try {
        // Fetch all operations for this company, origin, and tax group
        const operations = await getFiscalOperations(supabase, companyId, {
            taxGroupId: input.productTaxGroupId,
            originState: input.companyUF
        });

        if (!operations || operations.length === 0) {
            return {
                status: 'no_rule_found',
                error: 'Nenhuma operação fiscal encontrada para este grupo tributário'
            };
        }

        // Use domain logic for rule selection
        const { selectBestFiscalRule } = await import('@/lib/domain/fiscal/rules');
        const selectedOperation = selectBestFiscalRule(operations, {
            customerUF: input.customerUF,
            customerType: input.customerType,
            customerIsFinalConsumer: input.customerIsFinalConsumer
        });

        if (!selectedOperation) {
            return {
                status: 'no_rule_found',
                error: 'Nenhuma regra fiscal compatível encontrada para o cliente/destino'
            };
        }

        // Build result
        const result: FiscalResolutionResult = {
            status: 'calculated',
            operation: selectedOperation,
            cfop: selectedOperation.cfop,
            st_applies: selectedOperation.st_applies || false,
            pis_cst: selectedOperation.pis_cst,
            pis_aliquot: selectedOperation.pis_rate_percent,
            cofins_cst: selectedOperation.cofins_cst,
            cofins_aliquot: selectedOperation.cofins_rate_percent,
            ipi_applies: selectedOperation.ipi_applies || false,
            ipi_cst: selectedOperation.ipi_cst,
            ipi_aliquot: selectedOperation.ipi_rate_percent
        };

        // ICMS: Use CST or CSOSN based on regime
        if (input.companyTaxRegime === 'simples') {
            result.csosn = selectedOperation.icms_csosn;
        } else {
            result.cst_icms = selectedOperation.icms_cst;
        }

        // ST calculations (simplified - real calculation would need product value)
        if (selectedOperation.st_applies) {
            result.st_aliquot = selectedOperation.st_rate_percent;
            // Note: st_base_calc and st_value would be calculated with item price
        }

        return result;
    } catch (error: any) {
        console.error('Fiscal resolution error:', error);
        return {
            status: 'error',
            error: error.message || 'Erro ao resolver regra fiscal'
        };
    }
}

/**
 * Batch resolve fiscal rules for multiple items
 */
export async function resolveFiscalRulesForOrder(
    supabase: SupabaseClient,
    companyId: string,
    companyUF: string,
    companyTaxRegime: 'simples' | 'normal',
    customerUF: string,
    customerType: 'contribuinte' | 'isento' | 'nao_contribuinte',
    customerIsFinalConsumer: boolean,
    items: Array<{
        itemId: string;
        taxGroupId: string;
        ncm?: string;
        cest?: string;
        origin?: number;
        unitPrice?: number;
        quantity?: number;
    }>
): Promise<Map<string, FiscalResolutionResult>> {
    const results = new Map<string, FiscalResolutionResult>();

    for (const item of items) {
        const result = await resolveFiscalRule(supabase, companyId, {
            companyUF,
            companyTaxRegime,
            customerUF,
            customerType,
            customerIsFinalConsumer,
            productTaxGroupId: item.taxGroupId,
            productNCM: item.ncm,
            productCEST: item.cest,
            productOrigin: item.origin
        });

        results.set(item.itemId, result);
    }

    return results;
}
