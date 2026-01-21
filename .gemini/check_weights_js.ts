
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data, error } = await supabase.rpc('exec_sql', {
        sql_string: `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'items' AND column_name LIKE '%weight%';
        `
    });
    // Fallback if rpc fails or returns nothing useful directly (it usually returns null for data if it's void, or we need to handle result)
    // Actually exec_sql returns setof record or text usually if defined that way.

    // Let's just fetch one item and look at keys
    const { data: item } = await supabase.from('items').select('*').limit(1).single();
    if (item) {
        console.log("Item weight keys:", Object.keys(item).filter(k => k.includes('weight')));
    }
}
checkColumns();
