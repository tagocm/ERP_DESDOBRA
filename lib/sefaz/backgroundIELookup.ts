import { createAdminClient } from '../supabaseServer';
import { consultaCadastroSefaz } from './consultaCadastro';

const CAD_DEBUG = process.env.CAD_DEBUG === '1';
const CACHE_DAYS = 30;

interface IELookupOptions {
    force?: boolean; // Bypass cache
}

interface IELookupResult {
    success: boolean;
    cached?: boolean;
    ie?: string;
    error?: string;
}

/**
 * Background IE lookup service
 * Queries SEFAZ for client's IE and caches result for 30 days
 * Runs asynchronously and never throws - safe for background execution
 */
export async function backgroundIELookup(
    orgId: string,
    options: IELookupOptions = {}
): Promise<IELookupResult> {
    try {
        const supabase = createAdminClient();

        if (CAD_DEBUG) {
            console.log('[CAD_DEBUG] backgroundIELookup started', {
                orgId,
                force: options.force,
                timestamp: new Date().toISOString()
            });
        }

        // 1. Fetch organization
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id, document_number, ie, ie_source, ie_last_checked_at, addresses(state, is_default)')
            .eq('id', orgId)
            .single();

        if (orgError || !org) {
            if (CAD_DEBUG) {
                console.error('[CAD_DEBUG] Organization not found:', { orgId, error: orgError });
            }
            return { success: false, error: 'Organization not found' };
        }

        // 2. Check cache (skip if force=true)
        if (!options.force && org.ie && org.ie_last_checked_at) {
            const lastChecked = new Date(org.ie_last_checked_at);
            const now = new Date();
            const daysSinceCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceCheck < CACHE_DAYS) {
                if (CAD_DEBUG) {
                    console.log('[CAD_DEBUG] Cache hit', {
                        ie: org.ie,
                        daysSinceCheck: daysSinceCheck.toFixed(1),
                        cacheValidFor: (CACHE_DAYS - daysSinceCheck).toFixed(1)
                    });
                }
                return {
                    success: true,
                    cached: true,
                    ie: org.ie
                };
            }
        }

        // 3. Determine UF from addresses
        const defaultAddress = org.addresses?.find((a: any) => a.is_default);
        const uf = defaultAddress?.state;

        if (!uf) {
            if (CAD_DEBUG) {
                console.warn('[CAD_DEBUG] No UF found for organization', { orgId });
            }
            return { success: false, error: 'No UF found in default address' };
        }

        // 4. Clean CNPJ
        const cnpj = org.document_number?.replace(/\D/g, '');
        if (!cnpj || cnpj.length !== 14) {
            if (CAD_DEBUG) {
                console.warn('[CAD_DEBUG] Invalid CNPJ', { orgId, cnpj });
            }
            return { success: false, error: 'Invalid CNPJ' };
        }

        // 5. Call SEFAZ
        if (CAD_DEBUG) {
            console.log('[CAD_DEBUG] Calling SEFAZ...', { uf, cnpj: `${cnpj.slice(0, 2)}.***.***.****-**` });
        }

        const result = await consultaCadastroSefaz({
            uf,
            cnpj,
            environment: process.env.NFE_ENVIRONMENT as 'homologacao' | 'producao' || 'producao'
        });

        // 6. Update database
        if (result.success && result.ie) {
            const { error: updateError } = await supabase
                .from('organizations')
                .update({
                    ie: result.ie,
                    ie_source: 'sefaz',
                    ie_last_checked_at: new Date().toISOString(),
                    ie_sefaz_status: result.situacao || null
                })
                .eq('id', orgId);

            if (updateError) {
                if (CAD_DEBUG) {
                    console.error('[CAD_DEBUG] DB update failed:', updateError);
                }
                return { success: false, error: 'Failed to update database' };
            }

            if (CAD_DEBUG) {
                console.log('[CAD_DEBUG] IE updated successfully', {
                    orgId,
                    ie: result.ie,
                    situacao: result.situacao
                });
            }

            return {
                success: true,
                ie: result.ie
            };
        } else {
            // SEFAZ returned no IE or error - still update last_checked to prevent spam
            if (!result.success) {
                const { error: updateError } = await supabase
                    .from('organizations')
                    .update({
                        ie_last_checked_at: new Date().toISOString(),
                        ie_sefaz_status: 'consulta_falhou'
                    })
                    .eq('id', orgId);

                if (CAD_DEBUG && updateError) {
                    console.error('[CAD_DEBUG] Failed to update last_checked_at:', updateError);
                }
            }

            if (CAD_DEBUG) {
                console.warn('[CAD_DEBUG] No IE returned from SEFAZ', { error: result.error });
            }

            return {
                success: false,
                error: result.error || 'No IE found'
            };
        }
    } catch (error) {
        // CRITICAL: never throw - this is a background service
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (CAD_DEBUG) {
            console.error('[CAD_DEBUG] backgroundIELookup exception:', errorMsg);
        }

        return {
            success: false,
            error: errorMsg
        };
    }
}
