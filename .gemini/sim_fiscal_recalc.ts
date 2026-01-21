
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ------------- MOCKING recalculateFiscalForOrder logic ----------------
async function mockRecalculate(orderId: string) {
    console.log(`\n--- Simulating Recalculate for Order ${orderId} ---`);

    // 1. Fetch Items
    const { data: items, error } = await supabase
        .from('sales_document_items')
        .select(`*, product:items!inner(*)`)
        .eq('document_id', orderId);

    if (error || !items) {
        console.error("Error fetching items:", error);
        return;
    }
    console.log(`Found ${items.length} items.`);

    // 2. Simulate Loop Update
    for (const item of items) {
        console.log(`\nProcessing Item: ${item.id} (${item.product?.name})`);
        console.log(`  Current Total Weight: ${item.total_weight_kg}`);

        // Update dummy fiscal field to trigger update
        // We use 'fiscal_status' which exists
        const updatePayload = {
            fiscal_status: 'pending',
            // We do NOT send weight info, just like the real function
            // We do NOT send updated_at as it doesn't exist
            notes: (item.notes || '') + '.' // tiny change to ensure dirty update
        };

        const { data: updated, error: upError } = await supabase
            .from('sales_document_items')
            .update(updatePayload)
            .eq('id', item.id)
            .select()
            .single();

        if (upError) {
            console.error("  UPDATE FAILED:", upError);
        } else {
            console.log(`  Update Success. New Total Weight: ${updated.total_weight_kg}`);
            if (updated.total_weight_kg === 0 || updated.total_weight_kg === null) {
                console.error("  CRITICAL: Weight lost!");
            } else {
                console.log("  SUCCESS: Weight persisted.");
            }
        }
    }
}

async function run() {
    // Get Order ID for #16
    const { data: order } = await supabase.from('sales_documents').select('id, total_weight_kg').eq('document_number', 16).single();
    if (!order) {
        console.log("Order 16 not found.");
        return;
    }
    console.log(`Order 16 ID: ${order.id}`);
    console.log(`Order Pre-Calc Weight: ${order.total_weight_kg}`);

    await mockRecalculate(order.id);

    // Check Order Total
    const { data: orderAfter } = await supabase.from('sales_documents').select('total_weight_kg').eq('id', order.id).single();
    console.log(`Order Post-Calc Weight: ${orderAfter.total_weight_kg}`);
}

run();
