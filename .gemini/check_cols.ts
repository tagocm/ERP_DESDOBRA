
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCols() {
    const { data, error } = await supabase.rpc('exec_sql', {
        sql_string: `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sales_document_items' 
            ORDER BY column_name;
        `
    });
    // Fallback if rpc fails (it likely will)
    if (error) {
        // Just select one row and check keys
        const { data: row } = await supabase.from('sales_document_items').select('*').limit(1).maybeSingle();
        if (row) console.log("Keys:", Object.keys(row).sort());
    } else {
        console.log("Cols:", data);
    }
}

checkCols();
