
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking ALL weight columns...");
    const { error: selErr } = await supabase.from('items')
        .select('net_weight_kg_base, gross_weight_kg_base, net_weight_g_base, gross_weight_g_base')
        .limit(1);
    console.log("Full Select Error:", selErr);
}
check();
