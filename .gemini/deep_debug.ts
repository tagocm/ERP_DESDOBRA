
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deepDebugOrder16() {
    const { data: order } = await supabase.from('sales_documents').select('id').eq('document_number', 16).single();
    if (!order) return console.log("Order 16 not found");

    const { data: items } = await supabase
        .from('sales_document_items')
        .select(`
            id,
            item_id,
            manual_weight_override,
            total_weight_kg,
            packaging_id,
            qty_base,
            quantity,
            product:items(*)
        `)
        .eq('document_id', order.id);

    if (!items) return console.log("No items found");

    console.log(`\n--- Deep Debug Items (${items.length}) ---`);
    items.forEach((item: any) => {
        const p = item.product;
        console.log(`Item: ${p.name}`);
        console.log(`  ID: ${item.id}`);
        console.log(`  Manual Override: ${item.manual_weight_override}`);
        console.log(`  Current Subtotal Weight (DB): ${item.total_weight_kg}`);

        console.log(`  --- Trigger Inputs ---`);
        console.log(`  Packaging ID: ${item.packaging_id}`);
        console.log(`  Qty Base: ${item.qty_base}`);
        console.log(`  Quantity: ${item.quantity}`);
        console.log(`  Product KG Base: ${p.net_weight_kg_base} (Type: ${typeof p.net_weight_kg_base})`);
        console.log(`  Product G Base: ${p.net_weight_g_base} (Type: ${typeof p.net_weight_g_base})`);
        console.log(`  Product Gross KG Base: ${p.gross_weight_kg_base}`);
        console.log(`  Product Gross G Base: ${p.gross_weight_g_base}`);

        // Simulate Trigger Logic in JS
        let v_unit_weight = null;
        if (item.packaging_id) {
            console.log("  [Trigger Path] Packaging");
            // skipping packaging check as we know it's null for this item
        } else {
            console.log("  [Trigger Path] Base Unit");
            if (p.gross_weight_kg_base > 0) v_unit_weight = p.gross_weight_kg_base;
            else if (p.gross_weight_g_base > 0) v_unit_weight = p.gross_weight_g_base / 1000;
            else if (p.net_weight_kg_base > 0) v_unit_weight = p.net_weight_kg_base;
            else if (p.net_weight_g_base > 0) v_unit_weight = p.net_weight_g_base / 1000;
            else if (p.base_weight_kg > 0) v_unit_weight = p.base_weight_kg;
        }

        console.log(`  [Simulated] Unit Weight: ${v_unit_weight}`);
        const total = v_unit_weight * (item.qty_base || item.quantity || 0);
        console.log(`  [Simulated] Total Weight: ${total}`);
    });
}

deepDebugOrder16();
