// Script to check for specific client duplicates
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSpecificClient() {
    console.log('🔍 Checking for "Emporio do Arroz Integral Ltda"...\n');

    // Get all organizations with this name
    const { data: orgs, error } = await supabase
        .from('organizations')
        .select('id, trade_name, document_number, created_at, company_id, deleted_at')
        .ilike('trade_name', '%emporio%arroz%')
        .order('created_at');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${orgs.length} records:\n`);

    orgs.forEach((org, idx) => {
        console.log(`${idx + 1}. ID: ${org.id}`);
        console.log(`   Name: ${org.trade_name}`);
        console.log(`   CNPJ: ${org.document_number || 'N/A'}`);
        console.log(`   Company ID: ${org.company_id}`);
        console.log(`   Created: ${org.created_at}`);
        console.log(`   Deleted: ${org.deleted_at || 'Active'}`);
        console.log('');
    });

    // Check active only
    const activeOrgs = orgs.filter(o => !o.deleted_at);
    console.log(`\n📊 Active records: ${activeOrgs.length}`);
    console.log(`📊 Deleted records: ${orgs.length - activeOrgs.length}`);
}

checkSpecificClient().catch(console.error);
