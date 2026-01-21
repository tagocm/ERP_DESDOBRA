
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDeliveryDetails() {
    console.log(`\n--- Checking Delivery Details ---`);

    // 1. Get Order 18
    const { data: order } = await supabase.from('sales_documents').select('id').eq('document_number', 18).single();
    if (!order) { console.error("Order 18 not found"); return; }

    // 2. Get Deliveries for Order
    const { data: deliveries } = await supabase
        .from('deliveries')
        .select('*')
        .eq('sales_document_id', order.id);

    if (!deliveries || deliveries.length === 0) { console.error("No deliveries found for Order 18"); return; }

    const deliveryId = deliveries[0].id;
    console.log(`Testing Delivery ID: ${deliveryId}`);

    // 3. Test Detail Query
    const { data: detail, error } = await supabase
        .from('deliveries')
        .select(`
            *,
            items:delivery_items(
                *,
                sales_item:sales_document_items(
                    item:items(code, name, uom:uoms(symbol))
                )
            ),
            route:delivery_routes(id, name, route_date)
        `)
        .eq('id', deliveryId)
        .single();

    if (error) {
        console.error("Detail Query Failed:", error);
    } else {
        console.log("Detail Query Success!");
        console.log("Items count:", detail.items?.length);
        if (detail.items?.length > 0) {
            console.log("First Item nested:", JSON.stringify(detail.items[0].sales_item, null, 2));
        }
        console.log("Route:", detail.route);
    }
}

checkDeliveryDetails();
