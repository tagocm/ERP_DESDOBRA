
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
    console.log('🔍 Checking Schema for financial_events...');

    // Minimal hack to get keys since we can't query information_schema easily with RLS/permissions sometimes, 
    // but with service role we can try selecting 1 and checking keys.
    const { data, error } = await supabase
        .from('financial_events')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
        console.log('Sample row:', data[0]);
    } else {
        console.log('No rows found, cannot infer columns from result.');
        // If empty, we can try to insert a dummy to get an error with column names?
    }
}

checkSchema();
