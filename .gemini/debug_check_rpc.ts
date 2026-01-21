
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    console.log("--- Testing RPC get_route_product_aggregation ---");

    // Find route NOVA3 directly
    const { data: route } = await supabase.from('delivery_routes').select('id, name').eq('name', 'NOVA3').single();
    if (!route) { console.log("Route NOVA3 not found"); return; }
    console.log("Found Route:", route.name, route.id);

    const { data, error } = await supabase.rpc('get_route_product_aggregation', {
        p_route_id: route.id
    });

    if (error) {
        console.error("RPC Error:", error);
    } else {
        console.log("RPC Result:");
        // Find Granola item
        const granola = data?.find((p: any) => p.product_name.includes('Granola'));
        if (granola) {
            console.log(`Product: ${granola.product_name}`);
            console.log(`Total Quantity (Balance): ${granola.total_quantity}`);
        } else {
            console.log("Granola not found in result");
            console.log(JSON.stringify(data, null, 2));
        }
    }
}

testRpc();
