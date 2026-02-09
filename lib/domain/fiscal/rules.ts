
import { FiscalOperationDTO } from "@/lib/data/fiscal-operations";

export interface FiscalContext {
    customerUF: string;
    customerType: 'contribuinte' | 'isento' | 'nao_contribuinte';
    customerIsFinalConsumer: boolean;
}

export interface ScoredRule {
    operation: FiscalOperationDTO;
    score: number;
}

/**
 * Selects the best fiscal operation rule based on specificity scoring.
 * 
 * Scoring Rules:
 * - Base Score: 100 (for matching origin/tax_group)
 * - Destination State:
 *   - Exact Match: +50
 *   - "TODOS" / "*": +10
 * - Customer Type:
 *   - Exact Match: +30
 *   - "all" / null: +5
 * - Final Consumer:
 *   - Exact Match: +10
 * 
 * @param operations List of candidate operations (already filtered by Origin + TaxGroup)
 * @param context Customer context for matching
 * @returns The best matching operation found, or undefined if none match constraints
 */
export function selectBestFiscalRule(
    operations: FiscalOperationDTO[],
    context: FiscalContext
): FiscalOperationDTO | undefined {
    if (!operations || operations.length === 0) return undefined;

    const customerTypeMap: Record<string, string> = {
        'contribuinte': 'contributor',
        'isento': 'exempt',
        'nao_contribuinte': 'non_contributor'
    };

    const inputCustomerType = customerTypeMap[context.customerType] || context.customerType;

    const scoredOperations = operations
        .filter(op => op.is_active)
        .map(op => {
            let score = 100;

            // 1. Destination State Check
            if (op.destination_state === context.customerUF) {
                score += 50;
            } else if (op.destination_state.toUpperCase() === 'TODOS' || op.destination_state === '*') {
                score += 10;
            } else {
                return null; // Mismatch
            }

            // 2. Customer Type Check
            const opCustomerType = op.customer_ie_indicator;
            if (opCustomerType === inputCustomerType) {
                score += 30;
            } else if ((opCustomerType as string) === 'all' || !opCustomerType) {
                score += 5;
            } else {
                return null; // Mismatch
            }

            // 3. Final Consumer Check
            if (op.customer_is_final_consumer === context.customerIsFinalConsumer) {
                score += 10;
            }

            return { operation: op, score };
        })
        .filter((item): item is ScoredRule => item !== null);

    if (scoredOperations.length === 0) return undefined;

    // Sort: Score DESC, then UpdatedAt DESC
    scoredOperations.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.operation.updated_at || 0).getTime() - new Date(a.operation.updated_at || 0).getTime();
    });

    return scoredOperations[0].operation;
}
