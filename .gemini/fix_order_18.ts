
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOrder18() {
    console.log(`\n--- Fixing Order #0018 ---`);

    // 1. Get Order ID
    const { data: order } = await supabase.from('sales_documents').select('id').eq('document_number', 18).single();
    if (!order) {
        console.error("Order 18 not found");
        return;
    }
    const orderId = order.id;

    // 2. Fetch Items
    const { data: items, error } = await supabase
        .from('sales_document_items')
        .select(`*, packaging:item_packaging(gross_weight_kg, net_weight_kg), product:items!inner(*)`)
        .eq('document_id', orderId);

    if (error || !items) {
        console.error("Error fetching items:", error);
        return;
    }
    console.log(`Found ${items.length} items to fix.`);

    // 3. Update Each Item
    for (const item of items) {
        const product = item.product as any;
        const qty = Number(item.quantity) || 0;

        console.log(`Processing ${product.name} (Qty: ${qty})...`);

        let unitWeight = 0;

        if (item.packaging_id) {
            const pkg = (item as any).packaging;
            if (pkg) {
                // Prioritize gross, then net
                unitWeight = Number(pkg.gross_weight_kg) || Number(pkg.net_weight_kg) || 0;
            }
            if (unitWeight === 0) unitWeight = Number(item.unit_weight_kg) || 0;
        } else {
            // Base Product Logic
            const grossKg = Number(product.gross_weight_kg_base);
            const grossG = Number(product.gross_weight_g_base);
            const netKg = Number(product.net_weight_kg_base);
            const netG = Number(product.net_weight_g_base);
            // REMOVED legacy base_weight_kg check

            if (!isNaN(grossKg) && grossKg > 0) unitWeight = grossKg;
            else if (!isNaN(grossG) && grossG > 0) unitWeight = grossG / 1000.0;
            else if (!isNaN(netKg) && netKg > 0) unitWeight = netKg;
            else if (!isNaN(netG) && netG > 0) unitWeight = netG / 1000.0;
        }

        const totalWeight = Number((unitWeight * qty).toFixed(3));
        console.log(`  Calculated -> Unit: ${unitWeight}, Total: ${totalWeight}`);

        if (unitWeight > 0) {
            const { error: upError } = await supabase
                .from('sales_document_items')
                .update({
                    unit_weight_kg: unitWeight,
                    total_weight_kg: totalWeight
                })
                .eq('id', item.id);

            if (upError) console.error("  UPDATE FAILED:", upError);
            else console.log("  Update Saved.");
        } else {
            console.log("  SKIPPED: No weight found.");
        }
    }

    // 4. Update Parent Order Total
    // We let the trigger handle it? Or update manually?
    // Let's force an update on the parent to ensure consistency
    const { error: pError } = await supabase.rpc('update_sales_document_weights', { doc_id: orderId });
    if (pError) {
        console.error("Parent Update RPC Failed:", pError);
        // Fallback manual calc
        // But the trigger should have run on item update.
    } else {
        console.log("Parent Recalculation Triggered/RPC Called.");
    }
}

fixOrder18();
