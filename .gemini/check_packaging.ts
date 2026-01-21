
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPackaging() {
    // 1. Get items for Order #16
    const { data: order } = await supabase.from('sales_documents').select('id').eq('document_number', 16).single();
    if (!order) return console.log("Order 16 not found");

    const { data: items } = await supabase
        .from('sales_document_items')
        .select(`
            id,
            item_id,
            packaging_id,
            quantity,
            product:items(name),
            packaging:item_packaging(*)
        `)
        .eq('document_id', order.id);

    if (!items) return console.log("No items found");

    console.log("Checking Items Packaging...");
    items.forEach((item: any) => {
        console.log(`Item: ${item.product?.name}`);
        console.log(`  Packaging ID: ${item.packaging_id}`);
        if (item.packaging_id) {
            console.log(`  Packaging Data:`, item.packaging);
            const gross = item.packaging?.gross_weight_kg;
            const net = item.packaging?.net_weight_kg;
            console.log(`  Pkg Gross KG: ${gross}, Pkg Net KG: ${net}`);

            if (!gross && !net) {
                console.warn(`  WARNING: Packaging has NO weight! Trigger will yield NULL/0.`);
            }
        } else {
            console.log(`  No packaging (Base Unit)`);
        }
    });
}

checkPackaging();
