import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugReturnPayload() {
    console.log('\n=== Debugging Return Payload ===\n');

    // Find Order #20
    const { data: order } = await supabase
        .from('sales_documents')
        .select('id, document_number')
        .eq('document_number', 20)
        .single();

    if (!order) {
        console.log('Order #20 not found');
        return;
    }

    console.log(`Order #${order.document_number} (${order.id})`);

    // Find the route order
    const { data: routeOrder } = await supabase
        .from('delivery_route_orders')
        .select('*')
        .eq('sales_document_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!routeOrder) {
        console.log('No route order found');
        return;
    }

    console.log(`\nRoute Order ID: ${routeOrder.id}`);
    console.log(`Return Outcome: ${routeOrder.return_outcome_type}`);
    console.log(`\nReturn Payload:`);
    console.log(JSON.stringify(routeOrder.return_payload, null, 2));

    // Check if deliveredItems exists in payload
    if (routeOrder.return_payload) {
        const payload = routeOrder.return_payload;
        console.log('\n=== Payload Analysis ===');
        console.log('Has deliveredItems?', !!payload.deliveredItems);
        console.log('Has items?', !!payload.items);

        if (payload.items) {
            console.log('\npayload.items structure:');
            console.log(JSON.stringify(payload.items, null, 2));
        }

        if (payload.deliveredItems) {
            console.log('\npayload.deliveredItems structure:');
            console.log(JSON.stringify(payload.deliveredItems, null, 2));
        }
    }
}

debugReturnPayload();
