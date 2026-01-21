
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrder() {
    console.log("Checking Order #0018...");
    const { data: order } = await supabase.from('sales_documents')
        .select('*')
        .eq('document_number', 18)
        .single();

    if (!order) {
        console.log("Order 18 not found!");
        return;
    }
    console.log(`Order ID: ${order.id}`);
    console.log(`Total Weight KG: ${order.total_weight_kg}`);
    console.log(`Total Gross Weight KG: ${order.total_gross_weight_kg}`);

    const { data: items } = await supabase.from('sales_document_items')
        .select(`
            id, quantity, unit_weight_kg, total_weight_kg, packaging_id,
            product:items (id, name, gross_weight_kg_base, net_weight_kg_base, gross_weight_g_base, net_weight_g_base),
            packaging:item_packaging (id, label, gross_weight_kg, net_weight_kg)
        `)
        .eq('document_id', order.id);

    if (!items || items.length === 0) {
        console.log("No items found.");
    } else {
        console.log(`\nItems (${items.length}):`);
        items.forEach((item: any) => {
            console.log(`- ${item.product?.name}: Qty ${item.quantity}, UnitWt ${item.unit_weight_kg}, TotalWt ${item.total_weight_kg}`);
        });
    }
}

checkOrder();
