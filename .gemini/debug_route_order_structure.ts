import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRouteOrderStructure() {
    console.log('\n=== Debugging Route Order Structure ===\n');

    // 1. Find a recent route with status 'em_rota'
    const { data: routes } = await supabase
        .from('delivery_routes')
        .select('id, name, status')
        .eq('status', 'em_rota')
        .order('created_at', { ascending: false })
        .limit(1);

    if (!routes || routes.length === 0) {
        console.log('No routes with status em_rota found');
        return;
    }

    const routeId = routes[0].id;
    console.log(`Using Route: ${routes[0].name} (${routeId})\n`);

    // 2. Get route with orders (mimicking what RetornoClient fetches)
    const { data: route, error } = await supabase
        .from('delivery_routes')
        .select(`
            id,
            name,
            route_date,
            status,
            orders:delivery_route_orders(
                id,
                position,
                volumes,
                sales_document_id,
                sales_order:sales_documents(
                    id,
                    document_number,
                    total_amount,
                    total_weight_kg,
                    client:organizations!client_id(
                        id,
                        trade_name,
                        addresses(city)
                    ),
                    items:sales_document_items(
                        id,
                        quantity,
                        unit_price,
                        product:items(id, name, sku)
                    )
                )
            )
        `)
        .eq('id', routeId)
        .single();

    if (error || !route) {
        console.error('Error fetching route:', error);
        return;
    }

    console.log(`Route has ${route.orders?.length || 0} orders\n`);

    if (route.orders && route.orders.length > 0) {
        const firstOrder = route.orders[0];
        console.log('=== First Route Order Structure ===');
        console.log('routeOrder.id:', firstOrder.id);
        console.log('routeOrder.sales_document_id:', firstOrder.sales_document_id);
        console.log('routeOrder.volumes:', firstOrder.volumes);
        console.log('\nrouteOrder.sales_order exists:', !!firstOrder.sales_order);

        if (firstOrder.sales_order) {
            const so = firstOrder.sales_order;
            console.log('sales_order.id:', so.id);
            console.log('sales_order.document_number:', so.document_number);
            console.log('sales_order.items count:', so.items?.length || 0);

            if (so.items && so.items.length > 0) {
                const item = so.items[0];
                console.log('\n=== First Item in Order ===');
                console.log('item.id:', item.id);
                console.log('item.quantity:', item.quantity, '(This is what PartialReturnModal currently shows as "Qtd. Enviada")');
                console.log('item.unit_price:', item.unit_price);
                console.log('item.product.name:', item.product?.name);
            }
        }
    }

    // 3. Now check if there's delivery data with qty_loaded
    console.log('\n=== Checking Delivery Data ===');
    const { data: deliveries } = await supabase
        .from('deliveries')
        .select(`
            id,
            number,
            status,
            sales_document_id,
            items:delivery_items(
                id,
                sales_document_item_id,
                qty_planned,
                qty_loaded,
                qty_delivered
            )
        `)
        .eq('sales_document_id', route.orders?.[0]?.sales_document_id)
        .order('created_at', { ascending: false });

    if (deliveries && deliveries.length > 0) {
        const del = deliveries[0];
        console.log(`Found delivery #${del.number} (${del.status})`);
        console.log('Delivery items:');
        del.items?.forEach((dItem: any) => {
            console.log(`  - Item ${dItem.sales_document_item_id}`);
            console.log(`    qty_planned: ${dItem.qty_planned}`);
            console.log(`    qty_loaded: ${dItem.qty_loaded} (This should be "Qtd. Enviada"!)`);
            console.log(`    qty_delivered: ${dItem.qty_delivered}`);
        });
    } else {
        console.log('No deliveries found for this order');
    }

    console.log('\n=== CONCLUSION ===');
    console.log('The PartialReturnModal should display qty_loaded from delivery_items');
    console.log('instead of item.quantity from sales_document_items.');
    console.log('We need to pass delivery data to the modal OR fetch it inside the modal.');
}

debugRouteOrderStructure();
