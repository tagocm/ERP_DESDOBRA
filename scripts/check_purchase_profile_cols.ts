
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking columns...");

    // Check columns
    const { data: cols, error } = await supabase
        .rpc('get_table_columns', { table_name: 'item_purchase_profiles' });

    // If RPC doesn't exist (it usually doesn't by default), try direct query if I could, but I can't via client easily without custom parsing.
    // Instead, try to insert a dummy row with that column and see if it errors? No, that's messy.

    // Let's try to just select 'default_purchase_packaging_id' specifically
    const { data: specificCol, error: colError } = await supabase
        .from('item_purchase_profiles')
        .select('default_purchase_packaging_id')
        .limit(1);

    if (colError) {
        console.error("Column check error:", colError);
    } else {
        console.log("Column 'default_purchase_packaging_id' likely exists (no error selection).");
    }

    // Check row for Aveia again
    const { data: items } = await supabase.from('items').select('id, name').ilike('name', '%Aveia%').limit(1);
    if (items?.[0]) {
        console.log("Aveia ID:", items[0].id);
        const { data: prof, error: profError } = await supabase
            .from('item_purchase_profiles')
            .select('*')
            .eq('item_id', items[0].id);
        console.log("Profile:", prof, "Error:", profError);
    }
}

check();
