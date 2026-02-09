
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_USER_ID = '1e18ff6c-3a97-4b19-ba60-a6cc0971a31b';
const TARGET_COMPANY_ID = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

async function checkMembership() {
    console.log(`Checking membership for User: ${TARGET_USER_ID}`);

    // Check company_members
    const { data: members, error } = await supabase
        .from('company_members')
        .select('*')
        .eq('auth_user_id', TARGET_USER_ID);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${members?.length} memberships:`);
    members?.forEach(m => {
        console.log(`- Company: ${m.company_id} | Role: ${m.role || 'N/A'}`);
        if (m.company_id === TARGET_COMPANY_ID) {
            console.log('  -> MATCHES TARGET COMPANY ✅');
        } else {
            console.log('  -> MISMATCH ❌');
        }
    });

    // Verify Organization Company ID again
    const { data: orgs } = await supabase.from('organizations').select('id, trade_name, company_id').ilike('trade_name', '%mporio%');
    console.log(`\nOrganization 'Emporio' belongs to: ${orgs?.[0]?.company_id}`);

    if (orgs?.[0]?.company_id === TARGET_COMPANY_ID) {
        console.log('  -> MATCHES TARGET COMPANY ✅');
    } else {
        console.log('  -> MISMATCH ❌');
    }
}

checkMembership();
