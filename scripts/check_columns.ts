
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listColumns() {
    const { data, error } = await supabase
        .from('delivery_route_orders')
        .select('*')
        .limit(1);

    if (data && data.length > 0) {
        console.log("Keys in delivery_route_orders:", Object.keys(data[0]));
        console.log("Sample Data:", data[0]);
    } else {
        console.log("No data found or error", error);
    }
}

listColumns();
