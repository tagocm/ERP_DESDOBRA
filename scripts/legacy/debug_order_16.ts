
import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from '../_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrder16() {
    console.log("Checking Order #16...");

    // 1. Get Order
    const { data: order, error: orderError } = await supabase
        .from('sales_documents')
        .select('*')
        .eq('document_number', 16)
        .maybeSingle();

    if (orderError) {
        console.error("Order Error:", orderError);
        return;
    }

    if (!order) {
        console.log("Order #16 not found.");
        return;
    }

    console.log(`Order Found: ID=${order.id}, Status Logistic=${order.status_logistic}`);

    // 2. Get Route Info
    const { data: routeOrders, error: roError } = await supabase
        .from('delivery_route_orders')
        .select('route_id, route:delivery_routes(*)')
        .eq('sales_document_id', order.id);

    if (roError) {
        console.error("Route Order Error:", roError);
    } else {
        console.log("Routes for order:", JSON.stringify(routeOrders, null, 2));
    }
}

checkOrder16();
