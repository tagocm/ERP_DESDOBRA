
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectRoute() {
    console.log('--- Inspecting Route TESTE ---');

    // 1. Find Route
    const { data: route, error: routeError } = await supabase
        .from('delivery_routes')
        .select('*')
        .ilike('name', '%TESTE%')
        .limit(1)
        .single();

    if (routeError) { console.log('Route Error/Not Found:', routeError); return; }
    console.log('Route Found:', route.id, route.name);

    // 2. Get Orders
    const { data: orders, error: ordersError } = await supabase
        .from('delivery_route_orders')
        .select('id, sales_document_id, sales_documents(document_number)')
        .eq('route_id', route.id);

    if (ordersError) { console.error('Orders Error:', ordersError); return; }

    console.log(`Found ${orders.length} orders in route.`);
    orders.forEach(o => {
        console.log(`- RouteOrder ID: ${o.id}, Order ID: ${o.sales_document_id}, Num: ${o.sales_documents?.document_number}`);
    });

    // Check for duplicates
    const seen = new Set();
    orders.forEach(o => {
        if (seen.has(o.sales_document_id)) {
            console.error(`!!! DUPLICATE FOUND: Order ID ${o.sales_document_id} (${o.sales_documents?.document_number}) !!!`);
        }
        seen.add(o.sales_document_id);
    });
}

inspectRoute();
