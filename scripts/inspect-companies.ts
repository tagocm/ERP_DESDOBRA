
import { createAdminClient } from '@/lib/supabaseServer';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const supabase = createAdminClient();

    console.log('--- Companies ---');
    const { data: companies, error } = await supabase.from('companies').select('*');
    if (error) console.error(error);
    else console.log(JSON.stringify(companies, null, 2));

    console.log('\n--- Company Settings ---');
    const { data: settings } = await supabase.from('company_settings').select('*');
    if (settings) console.log(JSON.stringify(settings, null, 2));

    console.log('\n--- Users / Members ---');
    // Check if there's a join table or user link
    const { data: members } = await supabase.from('company_members').select('*');
    if (members) console.log(JSON.stringify(members, null, 2));
}

main();
