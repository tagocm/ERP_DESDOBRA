
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Or SERVICE_ROLE if RLS blocks (but anon usually can read items)

// Ideally use SERVICE_ROLE for script to bypass RLS if any
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkGranola() {
    const { data, error } = await supabase
        .from('items')
        .select('id, name, base_weight_kg, net_weight_g_base, gross_weight_g_base')
        .ilike('name', '%granola%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Found Items:', data);
}

checkGranola();
