
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkRouteOrders() {
    console.log("Checking route statuses...");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check routes 'Bras', 'HORA', 'ixx'
    const { data: routes, error } = await supabase
        .from('delivery_routes')
        .select(`
            name, scheduled_date,
            orders:delivery_route_orders(
                sales_order:sales_documents(document_number, status_logistic)
            )
        `)
        .in('name', ['Bras', 'HORA', 'ixx']);

    if (error) { console.error(error); return; }

    console.log(JSON.stringify(routes, null, 2));
}
checkRouteOrders();
