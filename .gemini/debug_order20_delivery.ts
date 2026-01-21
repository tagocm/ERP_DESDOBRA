import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugOrder20Delivery() {
    console.log('\n=== Debugging Order #20 Delivery Data ===\n');

    // 1. Find Order #20
    const { data: order } = await supabase
        .from('sales_documents')
        .select('id, document_number')
        .eq('document_number', 20)
        .single();

    if (!order) {
        console.log('Order #20 not found');
        return;
    }

    console.log(`Order #${order.document_number} (${order.id})\n`);

    // 2. Find deliveries for this order
    const { data: deliveries } = await supabase
        .from('deliveries')
        .select('id, number, status, route_id')
        .eq('sales_document_id', order.id)
        .order('created_at', { ascending: false });

    if (!deliveries || deliveries.length === 0) {
        console.log('No deliveries found for this order');
        return;
    }

    console.log(`Found ${deliveries.length} deliveries:\n`);

    for (const delivery of deliveries) {
        console.log(`Delivery #${delivery.number} (${delivery.id})`);
        console.log(`  Status: ${delivery.status}`);
        console.log(`  Route ID: ${delivery.route_id}`);

        // Get delivery items
        const { data: items } = await supabase
            .from('delivery_items')
            .select(`
                id,
                sales_document_item_id,
                qty_planned,
                qty_loaded,
                qty_delivered,
                qty_returned
            `)
            .eq('delivery_id', delivery.id);

        if (items && items.length > 0) {
            console.log(`  Items (${items.length}):`);
            items.forEach(item => {
                console.log(`    - Item ${item.sales_document_item_id}`);
                console.log(`      Planned: ${item.qty_planned}, Loaded: ${item.qty_loaded}, Delivered: ${item.qty_delivered}, Returned: ${item.qty_returned}`);
            });
        } else {
            console.log(`  No items found`);
        }
        console.log('');
    }

    // 3. Check route orders
    const { data: routeOrders } = await supabase
        .from('delivery_route_orders')
        .select('id, route_id, return_outcome_type, return_payload')
        .eq('sales_document_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1);

    if (routeOrders && routeOrders.length > 0) {
        const ro = routeOrders[0];
        console.log('Latest Route Order:');
        console.log(`  ID: ${ro.id}`);
        console.log(`  Route: ${ro.route_id}`);
        console.log(`  Outcome: ${ro.return_outcome_type}`);
        console.log(`  Payload:`);
        console.log(JSON.stringify(ro.return_payload, null, 2));
    }
}

debugOrder20Delivery();
