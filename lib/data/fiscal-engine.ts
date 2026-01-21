import { SupabaseClient } from '@supabase/supabase-js';
import { getFiscalOperations, FiscalOperation } from './fiscal-operations';

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
    operation?: FiscalOperation;
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

        // Filter and score by specificity
        const scoredOperations = operations
            .filter(op => op.is_active)
            .map(op => {
                let score = 0;

                // Mandatory: origin_state and tax_group already filtered
                score += 100; // Base score

                // Destination State: specific match = +50, "all" = +10
                if (op.destination_state === input.customerUF) {
                    score += 50;
                } else if (op.destination_state.toUpperCase() === 'TODOS' || op.destination_state === '*') {
                    score += 10;
                } else {
                    return null; // Doesn't match
                }

                // Customer Type: specific match = +30, "all" = +5
                const customerTypeMap: Record<string, string> = {
                    'contribuinte': 'contributor',
                    'isento': 'exempt',
                    'nao_contribuinte': 'non_contributor'
                };

                const opCustomerType = op.customer_ie_indicator;
                const inputCustomerType = customerTypeMap[input.customerType] || input.customerType;

                if (opCustomerType === inputCustomerType) {
                    score += 30;
                } else if (opCustomerType === 'all' || !opCustomerType) {
                    score += 5;
                } else {
                    return null; // Doesn't match
                }

                // Final Consumer: exact match = +10
                if (op.customer_is_final_consumer === input.customerIsFinalConsumer) {
                    score += 10;
                }

                return { operation: op, score };
            })
            .filter(item => item !== null) as Array<{ operation: FiscalOperation; score: number }>;

        if (scoredOperations.length === 0) {
            return {
                status: 'no_rule_found',
                error: 'Nenhuma regra fiscal compatível encontrada'
            };
        }

        // Sort by score DESC, then by updated_at DESC (most recent)
        scoredOperations.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return new Date(b.operation.updated_at || 0).getTime() - new Date(a.operation.updated_at || 0).getTime();
        });

        const selectedOperation = scoredOperations[0].operation;

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
