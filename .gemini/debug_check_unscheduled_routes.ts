
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkRoutes() {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check routes mentioned: 'ixx', 'HORA', 'Bras'
    const { data: routes, error } = await supabase
        .from('delivery_routes')
        .select('id, name, scheduled_date, created_at')
        .in('name', ['ixx', 'HORA', 'Bras']);

    if (error) { console.error(error); return; }

    console.log("Found Routes:", routes);
}

checkRoutes();
