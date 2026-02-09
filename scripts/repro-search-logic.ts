
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const COMPANY_ID = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';
const QUERY = 'emporio';

async function reproSearch() {
    console.log(`--- REPRO SEARCH: query="${QUERY}" company="${COMPANY_ID}" ---`);

    let queryBuilder = supabase
        .from('organizations')
        .select(`
            id,
            trade_name,
            legal_name,
            document_number,
            organization_roles!inner(role)
        `)
        .eq('company_id', COMPANY_ID)
        .is('deleted_at', null);

    // Filter by Role
    queryBuilder = queryBuilder.eq('organization_roles.role', 'customer');

    // Search Logic (Copied from Action)
    const searchTerm = QUERY.trim();
    if (searchTerm) {
        // 1. Normalize
        const normalizedSearch = searchTerm.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        console.log(`Normalized: ${normalizedSearch}`);

        // 2. Terms
        const terms = [searchTerm];
        if (normalizedSearch !== searchTerm) {
            terms.push(normalizedSearch);
        }

        // 3. Clean numeric
        const cleanSearch = searchTerm.replace(/[^\d]/g, '');
        const isNumeric = cleanSearch.length >= 2;

        // 4. Build OR
        const orClauses: string[] = [];
        terms.forEach(term => {
            orClauses.push(`trade_name.ilike.%${term}%`);
            orClauses.push(`legal_name.ilike.%${term}%`);
            if (isNumeric) {
                orClauses.push(`document_number.ilike.%${cleanSearch}%`);
            }
        });

        console.log(`OR Clauses: ${orClauses.join(',')}`);

        // 5. Apply OR
        queryBuilder = queryBuilder.or(orClauses.join(','));
    }

    const { data, error } = await queryBuilder.limit(20);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Found ${data?.length} records.`);
        data?.forEach(d => console.log(`- ${d.trade_name}`));
    }
}

reproSearch();
