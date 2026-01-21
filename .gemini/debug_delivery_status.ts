
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDeliveries() {
    console.log("--- Checking Deliveries for Order #26 ---");
    const orderNum = 26;

    // Get order ID
    const { data: order } = await supabase
        .from('sales_documents')
        .select('id, document_number')
        .eq('document_number', orderNum)
        .single();

    if (!order) {
        console.log("Order not found");
        return;
    }
    console.log(`Order ID: ${order.id}`);

    // Get deliveries
    const { data: deliveries } = await supabase
        .from('deliveries')
        .select('id, status, created_at, items:delivery_items(qty_delivered, sales_document_item_id)')
        .eq('sales_document_id', order.id);

    console.log("Deliveries found:", deliveries?.length);
    deliveries?.forEach(d => {
        console.log(`Delivery ${d.id}: Status='${d.status}'`);
        d.items?.forEach((i: any) => {
            console.log(`  - Item ItemID=${i.sales_document_item_id}: Delivered=${i.qty_delivered}`);
        });
    });
}

checkDeliveries();
