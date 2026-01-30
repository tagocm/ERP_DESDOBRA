
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOrder16() {
    console.log("Fixing Order #16 Delivery State...");

    const orderId = 'aedbd405-cfa0-4eb0-9e82-0bd878aacd11';

    // 1. Get Delivery
    const { data: deliveries, error: dError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('sales_document_id', orderId);

    if (dError) {
        console.error("Error fetching delivery:", dError);
        return;
    }

    if (!deliveries || deliveries.length === 0) {
        console.log("No delivery found for this order.");
        return;
    }

    const delivery = deliveries[0];
    console.log("Found delivery:", delivery.id, "Status:", delivery.status);

    if (delivery.status === 'in_route') {
        console.log("Updating delivery to 'delivered'...");

        // Update Delivery Status
        await supabase
            .from('deliveries')
            .update({ status: 'delivered', updated_at: new Date().toISOString() })
            .eq('id', delivery.id);

        // Update Items
        const { data: items } = await supabase
            .from('delivery_items')
            .select('*')
            .eq('delivery_id', delivery.id);

        if (items) {
            for (const item of items) {
                // Assume full delivery if order is 'entregue'
                await supabase
                    .from('delivery_items')
                    .update({
                        qty_delivered: item.qty_loaded,
                        qty_returned: 0,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id);
            }
            console.log(`Updated ${items.length} items.`);
        }
    } else {
        console.log("Delivery status is already", delivery.status);
    }
}

fixOrder16();
