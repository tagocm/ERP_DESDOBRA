
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

// using service key to bypass RLS for schema check, 
// but ideally we should reproduce with anon key if possible.
// sticking to service key to first check if column EXISTS.
const supabase = createClient(supabaseUrl, serviceKey);

async function testSearch() {
    console.log('--- Testing Query ---');

    const search = 'al';
    const type: string = 'supplier';
    // Mock company ID - need a valid one. I'll Fetch one.
    const { data: companies } = await supabase.from('companies').select('id').limit(1);
    const companyId = companies?.[0]?.id;

    if (!companyId) {
        console.error("No company found");
        return;
    }
    console.log(`Using Company ID: ${companyId}`);

    let selectQuery = 'id, trade_name, legal_name, document_number';
    if (type !== 'all') {
        selectQuery += ', organization_roles!inner(role)';
    }

    let query = supabase
        .from('organizations')
        .select(selectQuery)
        .eq('company_id', companyId)
        .is('deleted_at', null);

    if (type !== 'all') {
        query = query.eq('organization_roles.role', type);
    }

    query = query.or(`trade_name.ilike.%${search}%,legal_name.ilike.%${search}%`);

    const { data, error } = await query.limit(20);

    if (error) {
        console.error('QUERY ERROR:', JSON.stringify(error, null, 2));
    } else {
        console.log('QUERY SUCCESS:', data?.length, 'results');
        if (data?.length) console.log(data[0]);
    }
}

testSearch();
