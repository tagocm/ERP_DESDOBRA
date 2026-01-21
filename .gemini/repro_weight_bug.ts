
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectItemsTable() {
    const { data, error } = await supabase.rpc('exec_sql', {
        sql_string: `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'items' 
            AND column_name LIKE '%weight%';
        `
    });
    // Fallback: SELECT * LIMIT 1
    const { data: item } = await supabase.from('items').select('*').limit(1).single();
    if (item) {
        console.log("Existing weight columns on 'items':", Object.keys(item).filter(k => k.includes('weight')));
    }
}

async function reproduceIssue() {
    console.log("\n--- Reproduction Test ---");
    // 1. Get Order 16 Item
    const { data: order } = await supabase.from('sales_documents').select('id').eq('document_number', 16).single();
    const { data: items } = await supabase.from('sales_document_items').select('*').eq('document_id', order.id).limit(1);

    if (!items || items.length === 0) return console.log("No items.");
    const targetItem = items[0];

    console.log(`Target Item ID: ${targetItem.id}`);
    console.log(`Initial Total Weight: ${targetItem.total_weight_kg}`);

    // 2. Perform Update (Simulate Fiscal Recalc)
    // We update 'ncm_snapshot' to what it currently is (idempotent) or something dummy
    const updatePayload = {
        ncm_snapshot: targetItem.ncm_snapshot // keep same
    };

    const { data: updated, error: updateError } = await supabase
        .from('sales_document_items')
        .update(updatePayload)
        .eq('id', targetItem.id)
        .select()
        .single();

    if (updateError) console.error("Update Error:", updateError);
    else {
        console.log(`Post-Update Total Weight: ${updated.total_weight_kg}`);
        if (updated.total_weight_kg === 0 || updated.total_weight_kg === null) {
            console.error("FAIL: Weight became 0/NULL after update!");
        } else {
            console.log("SUCCESS: Weight persisted.");
        }
    }
}

async function run() {
    await inspectItemsTable();
    await reproduceIssue();
}

run();
