'use server';

import { createClient } from '@/utils/supabase/server';
import { getCompanyId } from './sales-actions';
import { OrganizationOptionDTO } from '@/lib/types/sales-dto';

export type ActionResult<T> = {
    success: boolean;
    data?: T;
    error?: string;
};

export async function searchOrganizationsAction(
    query: string,
    type: 'customer' | 'supplier' | 'carrier' | 'all' = 'all',
    preferredCompanyId?: string
): Promise<ActionResult<OrganizationOptionDTO[]>> {
    try {
        const companyId = await getCompanyId(preferredCompanyId, {
            // Performance path: this action is called on each keystroke.
            // RLS and company_id filter still protect access.
            skipMembershipValidation: Boolean(preferredCompanyId),
        });
        const supabase = await createClient();

        const buildOrganizationsQuery = (limit: number) => {
            let baseQuery = supabase
                .from('organizations')
                .select('id, trade_name, legal_name, document_number')
                .eq('company_id', companyId)
                .is('deleted_at', null)
                .order('trade_name', { ascending: true });

            const searchTerm = query.trim();
            if (searchTerm) {
                const normalizedSearch = searchTerm.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const terms = [searchTerm];
                if (normalizedSearch !== searchTerm) {
                    terms.push(normalizedSearch);
                }

                const cleanSearch = searchTerm.replace(/[^\d]/g, '');
                const isNumeric = cleanSearch.length >= 2;

                const orClauses: string[] = [];
                for (const term of terms) {
                    orClauses.push(`trade_name.ilike.%${term}%`);
                    orClauses.push(`legal_name.ilike.%${term}%`);
                    if (isNumeric) {
                        orClauses.push(`document_number.ilike.%${cleanSearch}%`);
                    }
                }

                baseQuery = baseQuery.or(orClauses.join(','));
            }

            return baseQuery.limit(limit);
        };

        const candidateLimit = type === 'all' ? 20 : 120;
        const { data: candidateRows, error: candidateError } = await buildOrganizationsQuery(candidateLimit);

        if (candidateError) {
            console.error('searchOrganizationsAction DB Error:', candidateError);
            throw new Error('Falha ao buscar organizações');
        }

        let rows: any[] = (candidateRows || []) as any[];

        if (type !== 'all' && rows.length > 0) {
            const candidateIds = rows.map((org: any) => org.id);

            const { data: roleRows, error: roleError } = await supabase
                .from('organization_roles')
                .select('organization_id')
                .eq('company_id', companyId)
                .eq('role', type)
                .is('deleted_at', null)
                .in('organization_id', candidateIds);

            if (roleError) {
                // Keep graceful behavior: if role filter fails, still return organizations by search.
                console.error('searchOrganizationsAction Role Filter Error:', roleError);
            } else {
                const allowedIds = new Set((roleRows || []).map((row: any) => row.organization_id));
                rows = rows.filter((org: any) => allowedIds.has(org.id));
            }
        }

        // Legacy compatibility: if no role match found, fallback to generic organization search.
        if ((type === 'customer' || type === 'supplier' || type === 'carrier') && rows.length === 0) {
            const { data: fallbackRows, error: fallbackError } = await buildOrganizationsQuery(20);
            if (!fallbackError && fallbackRows) {
                rows = fallbackRows as any[];
            }
        } else {
            rows = rows.slice(0, 20);
        }

        const dtos: OrganizationOptionDTO[] = rows.map((org: any) => {
            return {
                id: org.id,
                trade_name: org.trade_name,
                legal_name: org.legal_name,
                document_number: org.document_number
            };
        });

        // Dedup by ID just in case (if roles join causes multiplication - usually !inner doesn't if 1:1 but roles is 1:N)
        // If an org has multiple roles matching 'all'? 'all' doesn't join.
        // If type is specific, it matches that role. If user has multiple of SAME role? uniqueness constraint usually prevents this.
        // But let's be safe.
        const unique = Array.from(new Map(dtos.map(item => [item.id, item])).values());

        return { success: true, data: unique };

    } catch (e: any) {
        console.error('searchOrganizationsAction Error:', e);
        return { success: false, error: e.message };
    }
}
