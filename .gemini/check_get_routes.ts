
import { createClient } from '@supabase/supabase-js';
import { getRoutes } from '../lib/data/expedition';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testGetRoutes() {
    console.log("--- Testing getRoutes ---");

    // Find route NOVA3 directly
    const { data: route } = await supabase.from('delivery_routes').select('id, company_id').eq('name', 'NOVA3').single();
    if (!route) { console.log("Route NOVA3 not found in DB"); return; }
    console.log("Found NOVA3, Company:", route.company_id);

    try {
        const routes = await getRoutes(supabase, route.company_id);
        const nova3 = routes.find((r: any) => r.id === route.id);

        if (nova3) {
            console.log("Route NOVA3 fetched via getRoutes");
            const order26 = nova3.orders.find((ro: any) => ro.sales_order?.document_number === 26);
            if (order26) {
                console.log("Order #26 found in route");
                const salesOrder = order26.sales_order;
                console.log("Deliveries array length:", salesOrder.deliveries?.length); // Should be > 0
                if (salesOrder.deliveries?.length > 0) {
                    salesOrder.deliveries.forEach((d: any) => console.log(`- Deliv ${d.id}: Status='${d.status}'`));
                } else {
                    console.log("Deliveries array is EMPTY or Undefined");
                }

                console.log("Items balance breakdown:");
                salesOrder.items.forEach((item: any) => {
                    console.log(`- ${item.product?.name ?? 'Item'}: Qty=${item.quantity}, Balance=${item.balance}, Delivered=${item.delivered}`);
                });
            } else {
                console.log("Order #26 NOT found in NOVA3. Orders present:");
                nova3.orders.forEach((ro: any) => console.log(`- Order #${ro.sales_order?.document_number}`));
            }
        } else {
            console.log("Route NOVA3 not found in getRoutes result (even with correct company)");
        }
    } catch (e) {
        console.error("Error calling getRoutes:", e);
    }
}

testGetRoutes();
