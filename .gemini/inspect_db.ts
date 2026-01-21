
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use service role for admin tasks
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.rpc('exec_sql', {
        sql_string: `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sales_document_items' 
            ORDER BY column_name;
        `
    });

    // If exec_sql RPC doesn't exist (it usually doesn't by default), we can try to infer from a direct select if we can't run arbitrary SQL.
    // But since we are debugging, maybe we can just select one row to see structure?
    // No, 'select *' won't show us columns if there are no rows, or type info.

    // Alternative: Use postgrest to introspect? Supabase client doesn't expose introspection easily.

    // Let's try to just SELECT * LIMIT 1 and print keys.
    const { data: rows, error: selectError } = await supabase
        .from('sales_document_items')
        .select('*')
        .limit(1);

    if (selectError) {
        console.error("Select Error:", selectError);
    } else if (rows && rows.length > 0) {
        console.log("Columns found in first row:", Object.keys(rows[0]));
    } else {
        console.log("No rows found, cannot infer columns from data.");
        // If no data, we really need introspection.
        // Let's try to fetch from information_schema via standard query if RLS allows (unlikely for anon, but maybe for service role?)
        // Supabase JS client doesn't support querying information_schema directly usually unless exposed.

        // Wait, if I am service role, I bypass RLS. But I can only query tables exposed in the API. information_schema is usually NOT exposed.
    }
}

run();
