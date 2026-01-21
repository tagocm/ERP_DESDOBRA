import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V'; // service role

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestOrder() {
    console.log('🔍 Checking latest sales order...\n');

    // Get the latest order with Granola
    const { data: items, error } = await supabase
        .from('sales_document_items')
        .select(`
      id,
      quantity,
      qty_base,
      packaging_id,
      sales_uom_abbrev_snapshot,
      base_uom_abbrev_snapshot,
      conversion_factor_snapshot,
      sales_unit_label_snapshot,
      product:items!item_id(name),
      packaging:item_packaging!packaging_id(label, type, qty_in_base)
    `)
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    if (!items || items.length === 0) {
        console.log('⚠️  No items found');
        return;
    }

    console.log('📋 Latest sales order items:\n');

    items.forEach((item: any, idx) => {
        console.log(`Item ${idx + 1}:`);
        console.log('  Product:', item.product?.name);
        console.log('  Quantity:', item.quantity);
        console.log('  Qty Base:', item.qty_base);
        console.log('  Packaging:', item.packaging?.label, `(${item.packaging?.qty_in_base}x)`);
        console.log('  Snapshots:');
        console.log('    - Sales UOM:', item.sales_uom_abbrev_snapshot || '❌ NOT SET');
        console.log('    - Base UOM:', item.base_uom_abbrev_snapshot || '❌ NOT SET');
        console.log('    - Factor:', item.conversion_factor_snapshot || '❌ NOT SET');
        console.log('    - Label:', item.sales_unit_label_snapshot || '❌ NOT SET');
        console.log('');
    });

    // Check if snapshots are missing
    const hasSnapshots = items.some((item: any) => item.sales_uom_abbrev_snapshot);

    if (!hasSnapshots) {
        console.log('⚠️  PROBLEM DETECTED: Snapshots were NOT populated!');
        console.log('');
        console.log('Possible causes:');
        console.log('1. Item does not have packaging_id set');
        console.log('2. Error in upsertSalesItem snapshot logic');
        console.log('3. Snapshot population code not running');
    } else {
        console.log('✅ Snapshots are populated correctly!');
    }
}

checkLatestOrder().catch(console.error);
