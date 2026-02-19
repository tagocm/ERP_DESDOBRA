
import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from '../_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExpeditionRoutes() {
    console.log("Fetching expedition routes...");
    const companyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569'; // Got this from previous debug output

    // Mimic getExpeditionRoutes
    let query = supabase
        .from('delivery_routes')
        .select(`
            *,
            orders:delivery_route_orders(
                id, position, volumes, loading_status, partial_payload, sales_document_id,
                sales_order:sales_documents(
                    id, document_number, total_amount, status_logistic, total_weight_kg,
                    loading_checked, loading_checked_at,
                    client:organizations!client_id(
                        id, trade_name, legal_name,
                        addresses(city, state)
                    ),
                    items:sales_document_items(
                        id, quantity, unit_price
                    ),
                    events:order_delivery_events(id, event_type, note)
                )
            )
        `)
        .eq('company_id', companyId)
        .eq('status', 'planned')
        .not('scheduled_date', 'is', null);

    const { data, error } = await query;

    if (error) {
        console.error("Error:", JSON.stringify(error, null, 2));
        return;
    }

    console.log("Found", data.length, "routes matching expedition criteria.");
    if (data.length > 0) {
        console.log("Route[0] scheduled_date:", data[0].scheduled_date);
        console.log("Route[0] orders count:", data[0].orders.length);
        if (data[0].orders.length > 0) {
            console.log("Route[0] Order[0] sales_order:", data[0].orders[0].sales_order ? "FOUND" : "NULL (RLS blocked?)");
        }
    }
}

checkExpeditionRoutes();
