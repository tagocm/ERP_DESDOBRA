import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addParcialStatus() {
    console.log('\n=== Adding parcial to logistics_status enum ===\n');

    const { data, error } = await supabase.rpc('exec_sql', {
        sql_string: "ALTER TYPE logistics_status_new ADD VALUE IF NOT EXISTS 'parcial' AFTER 'entregue';"
    });

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success! Added parcial status');
    }
}

addParcialStatus();
