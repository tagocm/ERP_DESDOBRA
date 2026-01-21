import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDeliveryUpdate() {
    console.log('\n=== Testing Delivery Update Logic ===\n');

    // Simulate the finish-return logic
    const deliveryId = 'ee6d99a4-a6f0-4bee-ad83-25091527a8c3';

    // Get delivery items
    const { data: deliveryItems } = await supabase
        .from('delivery_items')
        .select('id, sales_document_item_id, qty_loaded')
        .eq('delivery_id', deliveryId);

    console.log('Delivery Items:');
    console.log(JSON.stringify(deliveryItems, null, 2));

    // Simulate payload from modal
    const payload = {
        deliveredItems: [
            {
                itemId: '94501484-2277-4c76-b436-d42b41e59e2c', // This is sales_document_item_id
                deliveredQty: 5
            }
        ]
    };

    console.log('\nPayload from Modal:');
    console.log(JSON.stringify(payload, null, 2));

    // Run the logic
    const deliveredMap = new Map();
    if (payload.deliveredItems && Array.isArray(payload.deliveredItems)) {
        payload.deliveredItems.forEach((i: any) => {
            console.log(`\nAdding to map: ${i.itemId} => ${i.deliveredQty}`);
            deliveredMap.set(i.itemId, i.deliveredQty);
        });
    }

    console.log('\nDeliveredMap:');
    console.log(deliveredMap);

    if (deliveryItems) {
        const updates = deliveryItems.map(di => {
            console.log(`\nProcessing delivery_item ${di.id}:`);
            console.log(`  sales_document_item_id: ${di.sales_document_item_id}`);
            console.log(`  Looking up in map...`);
            console.log(`  Has key? ${deliveredMap.has(di.sales_document_item_id)}`);

            const deliveredQty = deliveredMap.has(di.sales_document_item_id)
                ? Number(deliveredMap.get(di.sales_document_item_id))
                : 0;

            const loaded = Number(di.qty_loaded || 0);
            const returned = Math.max(0, loaded - deliveredQty);

            console.log(`  deliveredQty: ${deliveredQty}, loaded: ${loaded}, returned: ${returned}`);

            return {
                itemId: di.id,
                qtyDelivered: deliveredQty,
                qtyReturned: returned
            };
        });

        console.log('\nFinal updates:');
        console.log(JSON.stringify(updates, null, 2));
    }
}

testDeliveryUpdate();
