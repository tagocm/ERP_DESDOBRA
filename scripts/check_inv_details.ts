
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking schema...");

    const { data: cols, error } = await supabase
        .rpc('get_table_columns', { table_name: 'inventory_movements' });

    if (error) {
        // Fallback or use direct select if RPC missing
        console.log("RPC failed, trying empty insert exploit? No.");

        // Let's try to query a known column to verify access
        const { data, error: selErr } = await supabase.from('inventory_movements').select('id, reason, qty_in').limit(1);
        console.log("Basic select:", selErr ? selErr : "OK");
    } else {
        console.log("Columns:", cols);
    }

    // Check Aveia UOM
    const { data: items } = await supabase.from('items').select('id, name, uom').ilike('name', '%Aveia%').limit(1);
    if (items?.[0]) {
        console.log("Item:", items[0]);
    } else {
        console.log("Item 'Aveia' not found");
    }
}

check();
