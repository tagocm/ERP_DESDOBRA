
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoutesFull() {
    console.log("Fetching routes full query...");
    const { data: routes, error } = await supabase
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
                        id, quantity, unit_price,
                        product:items(id, name, sku, uom)
                    ),
                    events:order_delivery_events(id, event_type, note, reason:delivery_reasons(name))
                )
            )
        `)
        .eq('status', 'planned') // Simulating the filter
        .limit(10);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Found", routes.length, "routes.");
    if (routes.length > 0) {
        console.log("First route orders:", JSON.stringify(routes[0].orders, null, 2));
    }
}

checkRoutesFull();
