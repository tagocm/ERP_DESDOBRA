
import { createClient } from '@supabase/supabase-js';
import { getScheduledRoutes } from '../lib/data/expedition';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testScheduled() {
    console.log("--- Testing getScheduledRoutes ---");

    // Company ID
    const { data: route } = await supabase.from('delivery_routes').select('id, company_id, scheduled_date').eq('name', 'NOVA3').single();
    if (!route) { console.log("Route NOVA3 not found"); return; }

    const d = route.scheduled_date; // '2026-01-04'

    try {
        const routes = await getScheduledRoutes(supabase, route.company_id, d, d);
        const nova3 = routes.find((r: any) => r.id === route.id);

        if (nova3) {
            console.log("Route NOVA3 fetched via getScheduledRoutes");
            const order26 = nova3.orders.find((ro: any) => ro.sales_order?.document_number === 26);
            if (order26) {
                console.log("Order #26 found");
                order26.sales_order.items.forEach((item: any) => {
                    console.log(`- ${item.product?.name ?? 'Item'}: Qty=${item.quantity}, Balance=${item.balance}, Delivered=${item.delivered}`);
                });
            } else {
                console.log("Order #26 NOT found in NOVA3");
            }
        } else {
            console.log("Route NOVA3 not found in results");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testScheduled();
