import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

type SeedArgKey = 'p_company_id' | 'company_id';

const SEED_ARG_KEYS: readonly SeedArgKey[] = ['p_company_id', 'company_id'] as const;

function formatRpcError(error: PostgrestError): string {
    return [error.message, error.details, error.hint, error.code ? `SQLSTATE ${error.code}` : null]
        .filter((part): part is string => Boolean(part))
        .join(' | ');
}

export async function seedChartSpineRpc(admin: SupabaseClient, companyId: string): Promise<void> {
    const attempts: string[] = [];
    let onlySchemaCacheMiss = true;

    for (const argKey of SEED_ARG_KEYS) {
        const payload: Record<SeedArgKey, string> = {
            p_company_id: companyId,
            company_id: companyId,
        };
        const { error } = await admin.rpc('seed_chart_spine', { [argKey]: payload[argKey] });

        if (!error) {
            return;
        }

        attempts.push(`[${argKey}] ${formatRpcError(error)}`);
        if (error.code !== 'PGRST202') {
            onlySchemaCacheMiss = false;
            break;
        }
    }

    const baseMessage = attempts.join(' || ');
    if (onlySchemaCacheMiss) {
        throw new Error(
            `Falha ao inicializar estrutura fixa do plano de contas: ${baseMessage}. ` +
            'A função RPC seed_chart_spine não foi encontrada no cache do PostgREST. ' +
            "Aplique as migrations no banco em uso e execute: SELECT pg_notify('pgrst', 'reload schema');",
        );
    }

    throw new Error(`Falha ao inicializar estrutura fixa do plano de contas: ${baseMessage}`);
}
