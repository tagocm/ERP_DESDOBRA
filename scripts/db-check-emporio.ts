
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role to bypass RLS for truth finding

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmporio() {
    console.log('--- DB TRUTH CHECK ---');

    // Search for any variation of mporio to bypass first letter case/accent issues
    const { data: orgs, error } = await supabase
        .from('organizations')
        .select('id, trade_name, legal_name, document_number, company_id')
        .ilike('trade_name', '%mporio%');

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    console.log(`Found ${orgs?.length} records matching %mporio%:`);

    for (const org of orgs || []) {
        console.log('------------------------------------------------');
        console.log(`ID: ${org.id}`);
        console.log(`Company ID: ${org.company_id}`);
        console.log(`Trade Name: "${org.trade_name}"`);
        console.log(`Legal Name: "${org.legal_name}"`);
        console.log(`Document: ${org.document_number}`);

        // Check unicode for Trade Name
        const tradeCodes = (org.trade_name || '').split('').map((c: string) => c.charCodeAt(0));
        console.log(`Trade Name Codes: ${JSON.stringify(tradeCodes)}`);
        console.log(`Has Accent (ó=243, Ó=211)? ${tradeCodes.includes(243) || tradeCodes.includes(211)}`);

        // Check Roles
        const { data: roles } = await supabase
            .from('organization_roles')
            .select('role')
            .eq('organization_id', org.id);

        console.log(`Roles: ${roles?.map(r => r.role).join(', ')}`);
    }
}

checkEmporio();
