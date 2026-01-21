
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrderWeight() {
    // 1. Get ID for Order #0016
    const { data: order, error: orderError } = await supabase
        .from('sales_documents')
        .select('*')
        .eq('document_number', 16)
        .single();

    if (orderError) {
        console.error("Error fetching order:", orderError);
        return;
    }

    console.log(`Order #16 ID: ${order.id}`);
    console.log(`Current Total Weight (KG): ${order.total_weight_kg}`);
    console.log(`Current Gross Weight (KG): ${order.total_gross_weight_kg}`);

    // 2. Fetch Items
    const { data: items, error: itemsError } = await supabase
        .from('sales_document_items')
        .select(`
            id,
            item_id,
            quantity,
            qty_base,
            product:items(
                id,
                name,
                net_weight_kg_base,
                net_weight_g_base,
                gross_weight_kg_base,
                gross_weight_g_base
            )
        `)
        .eq('document_id', order.id);

    if (itemsError) {
        console.error("Error fetching items:", itemsError);
        return;
    }

    console.log("\n--- Item Details ---");
    let calculatedNet = 0;

    items.forEach((item: any) => {
        const prod = item.product;
        const qty = item.qty_base || item.quantity || 0;

        // Logic mirroring the migration
        const weightKg = prod.net_weight_kg_base || 0;
        const weightG = prod.net_weight_g_base || 0;
        const finalWeight = weightKg > 0 ? weightKg : (weightG / 1000);

        const lineTotal = finalWeight * qty;
        calculatedNet += lineTotal;

        console.log(`Item: ${prod.name}`);
        console.log(`  Qty: ${qty}`);
        console.log(`  Weight KG: ${calculateWeight(weightKg)}`);
        console.log(`  Weight G: ${calculateWeight(weightG)}`);
        console.log(`  Final Unit Weight (kg): ${finalWeight}`);
        console.log(`  Line Total (kg): ${lineTotal}`);
    });

    console.log(`\nVerified Calculated Total (JS): ${calculatedNet}`);
}

function calculateWeight(val: any) {
    return val ? val : 0;
}

checkOrderWeight();
