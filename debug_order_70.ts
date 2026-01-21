
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    try {
        const envPath = path.resolve(__dirname, '.env.local');
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key?.trim() === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value.trim();
            if (key?.trim() === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = value.trim();
        });
    } catch (e) { }
}
const supabase = createClient(supabaseUrl!, serviceKey!);

async function checkOrder70() {
    console.log("--- Checking Order #70 ---");
    const { data: order, error } = await supabase
        .from('sales_documents')
        .select(`
            id, document_number, total_amount, status_commercial, status_logistic,
            items:sales_document_items(*)
        `)
        .eq('document_number', 70)
        .single();

    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Order Header:", {
            id: order.id,
            total_amount: order.total_amount,
            status: order.status_commercial,
            logistic: order.status_logistic
        });
        console.log("Items:");
        order.items.forEach((item: any, i: number) => {
            console.log(`[${i}] ItemID: ${item.id} | Product: ${item.item_id} | Qty: ${item.quantity} | Total: ${item.total_amount}`);
        });

        // Check Route Link
        const { data: routeLinks } = await supabase
            .from('delivery_route_orders')
            .select('*')
            .eq('sales_document_id', order.id);

        console.log("Route Links:");
        routeLinks?.forEach((link: any, i: number) => {
            console.log(`Link [${i}]: ID=${link.id} Status=${link.loading_status}`);
            if (link.partial_payload) {
                console.log("Partial Payload Items:", JSON.stringify(link.partial_payload.items, null, 2));
            }
        });
    }
}

checkOrder70();
