
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUnaccent() {
    console.log('Checking unaccent() function...');

    // Attempt to select unaccent('téste')
    // We can't use .select('unaccent(...)') directly easily?
    // We can use .rpc() if we have a function wrapping it, but we can try to filter on dummy table?

    // Better: use rpc or just try to filter a known table with unaccent
    // organizations where unaccent(trade_name) ilike ...

    const { data, error } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .filter('unaccent(trade_name)', 'ilike', '%a%'); // Dummy filter

    if (error) {
        console.error('unaccent() check FAILED:', error.message);
    } else {
        console.log('unaccent() check PASSED (Query executed without error).');
    }
}

checkUnaccent();
