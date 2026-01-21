
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data, error } = await supabase.rpc('exec_sql', {
        sql_string: `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sales_document_items' 
            ORDER BY column_name;
        `
    });

    if (data) console.log("Columns:", data.map((c: any) => c.column_name));
    else console.log("No data or error", error);
}

checkColumns();
