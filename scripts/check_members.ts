
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMembers() {
    const companyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';
    console.log(`Checking members for company: ${companyId}`);

    const { data: members, error } = await supabase
        .from('company_members')
        .select('auth_user_id, role, profiles:auth_user_id(email)')
        .eq('company_id', companyId);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Members:', JSON.stringify(members, null, 2));
}

checkMembers();
