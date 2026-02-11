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

        let queryBuilder = supabase
            .from('organizations')
            .select(`
                id,
                trade_name,
                legal_name,
                document_number
                ${type !== 'all' ? ', organization_roles!inner(role)' : ''}
            `)
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .order('trade_name', { ascending: true });

        // Filter by Role (Inner Join)
        if (type !== 'all') {
            queryBuilder = queryBuilder.eq('organization_roles.role', type);
        }

        // Search Logic
        const searchTerm = query.trim();

        if (searchTerm) {
            // 1. Normalize search term (remove accents)
            const normalizedSearch = searchTerm.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // 2. Identify unique terms to search (original + normalized)
            const terms = [searchTerm];
            if (normalizedSearch !== searchTerm) {
                terms.push(normalizedSearch);
            }

            // 3. Clean for numeric search (only from original, or normalized? same result for digits)
            const cleanSearch = searchTerm.replace(/[^\d]/g, '');
            const isNumeric = cleanSearch.length >= 2;

            // 4. Build OR clauses
            const orClauses: string[] = [];

            terms.forEach(term => {
                orClauses.push(`trade_name.ilike.%${term}%`);
                orClauses.push(`legal_name.ilike.%${term}%`);
                if (isNumeric) {
                    orClauses.push(`document_number.ilike.%${cleanSearch}%`);
                }
            });

            // 5. Apply OR filter
            // Note: .or() implies OR between arguments.
            // We join our clauses with commas for the Supabase .or() method.
            queryBuilder = queryBuilder.or(orClauses.join(','));
        }

        const { data, error } = await queryBuilder.limit(20);


        if (error) {
            console.error('searchOrganizationsAction DB Error:', error);
            throw new Error('Falha ao buscar organizações');
        }

        // Map to DTO
        let rows: any[] = (data || []) as any[];

        if ((type === 'customer' || type === 'supplier' || type === 'carrier') && rows.length === 0) {
            const fallbackSearch = query.trim();
            let fallbackQuery = supabase
                .from('organizations')
                .select('id, trade_name, legal_name, document_number')
                .eq('company_id', companyId)
                .is('deleted_at', null)
                .order('trade_name', { ascending: true });

            if (fallbackSearch) {
                const cleanSearch = fallbackSearch.replace(/[^\d]/g, '');
                const fallbackClauses: string[] = [
                    `trade_name.ilike.%${fallbackSearch}%`,
                    `legal_name.ilike.%${fallbackSearch}%`,
                ];
                if (cleanSearch.length >= 2) {
                    fallbackClauses.push(`document_number.ilike.%${cleanSearch}%`);
                }
                fallbackQuery = fallbackQuery.or(fallbackClauses.join(','));
            }

            const { data: fallbackRows, error: fallbackError } = await fallbackQuery.limit(20);
            if (!fallbackError && fallbackRows) {
                rows = fallbackRows as any[];
            }
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
