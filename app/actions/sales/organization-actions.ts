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
    type: 'customer' | 'supplier' | 'carrier' | 'all' = 'all'
): Promise<ActionResult<OrganizationOptionDTO[]>> {
    try {
        const companyId = await getCompanyId();
        const client = await createClient();
        const user = (await client.auth.getUser()).data.user;
        const supabase = client;

        let queryBuilder = supabase
            .from('organizations')
            .select(`
                id,
                trade_name,
                legal_name,
                document_number,
                addresses(city, state)
                ${type !== 'all' ? ', organization_roles!inner(role)' : ''}
            `)
            .eq('company_id', companyId)
            .is('deleted_at', null);

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
        const dtos: OrganizationOptionDTO[] = (data || []).map((org: any) => {
            // Handle duplicates if any (though unlikely with simple select)
            // Address derivation
            const addr = org.addresses?.[0];
            const cityState = addr ? `${addr.city}/${addr.state}` : undefined;

            return {
                id: org.id,
                trade_name: org.trade_name,
                legal_name: org.legal_name,
                document_number: org.document_number,
                city_state: cityState
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
