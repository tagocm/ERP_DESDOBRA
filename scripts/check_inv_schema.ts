
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking for unit_cost column...");
    const { error: errCost } = await supabase.from('inventory_movements').select('unit_cost').limit(1);

    if (errCost) {
        console.log("unit_cost Missing:", errCost.message);
    } else {
        console.log("unit_cost Exists.");
    }

    console.log("Checking for reason column...");
    const { error: errReason } = await supabase.from('inventory_movements').select('reason').limit(1);
    if (errReason) {
        console.log("reason Missing:", errReason.message);
    } else {
        console.log("reason Exists.");
    }
}
check();
