
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Use SERVICE KEY to see the TRUTH (raw data)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugPlanning() {
    console.log('--- DEBUGGING NULL COLUMNS ---');

    const { data: routeOrders, error } = await supabase
        .from('delivery_route_orders')
        .select('id, route_id, order_id, company_id')
        .limit(10);

    if (error) console.error(error);

    if (routeOrders) {
        console.table(routeOrders);
        const nullCompany = routeOrders.filter(r => !r.company_id);
        if (nullCompany.length > 0) {
            console.error("CRITICAL: Found delivery_route_orders with NULL company_id. RLS will hide these.");
        } else {
            console.log("All checked delivery_route_orders have company_id.");
        }
    }

    // Also check delivery_routes
    const { data: routes } = await supabase
        .from('delivery_routes')
        .select('id, company_id, scheduled_date')
        .limit(5);

    console.log("Routes Sample:");
    console.table(routes);
}

debugPlanning();
