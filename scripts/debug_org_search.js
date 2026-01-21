
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function testSearch() {
    console.log('--- Testing Query ---');

    const search = 'al';
    const type = 'supplier';

    // 1. Get a company ID
    const { data: companies } = await supabase.from('companies').select('id').limit(1);
    const companyId = companies?.[0]?.id;

    if (!companyId) {
        console.error("No company found");
        return;
    }
    console.log(`Using Company ID: ${companyId}`);

    // Test Query
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
        console.error('QUERY ERROR DETAIL:', JSON.stringify(error, null, 2));
    } else {
        console.log('QUERY SUCCESS:', data?.length, 'results');
        if (data?.length) console.log(JSON.stringify(data[0], null, 2));
    }
}

testSearch();
