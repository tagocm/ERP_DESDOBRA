import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNfeDescription() {
    // Get latest order with snapshots
    const { data: items } = await supabase
        .from('sales_document_items')
        .select(`
      id,
      quantity,
      qty_base,
      sales_uom_abbrev_snapshot,
      base_uom_abbrev_snapshot,
      conversion_factor_snapshot,
      sales_unit_label_snapshot,
      product:items!item_id(name)
    `)
        .not('sales_uom_abbrev_snapshot', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!items || items.length === 0) {
        console.log('No items with snapshots found');
        return;
    }

    const item = items[0] as any;

    console.log('\n📋 ITEM WITH SNAPSHOTS:\n');
    console.log('Product:', item.product.name);
    console.log('Quantity (COM):', item.quantity, item.sales_uom_abbrev_snapshot);
    console.log('Qty Base (TRIB):', item.qty_base, item.base_uom_abbrev_snapshot);
    console.log('Conversion Factor:', item.conversion_factor_snapshot);
    console.log('Unit Label:', item.sales_unit_label_snapshot);

    console.log('\n📝 EXPECTED NFe DESCRIPTION:\n');

    const itemName = item.product.name;
    const salesUom = item.sales_uom_abbrev_snapshot;
    const baseUom = item.base_uom_abbrev_snapshot;
    const factor = item.conversion_factor_snapshot;
    const qtyCom = item.quantity;
    const qtyBase = item.qty_base;

    // Build description like the helper does
    const baseDesc = `${itemName} - ${salesUom} ${factor}x${baseUom}`;
    const equivalence = `(${qtyCom} ${salesUom} = ${qtyBase} ${baseUom})`;

    const fullDesc = `${baseDesc} ${equivalence}`;

    console.log('Full Description:', fullDesc);
    console.log('Length:', fullDesc.length, '/ 120 chars');

    if (fullDesc.length <= 120) {
        console.log('\n✅ xProd:', fullDesc);
        console.log('✅ infAdProd: (empty)');
    } else {
        console.log('\n⚠️  Too long! Overflow to infAdProd:');
        console.log('   xProd:', baseDesc);
        console.log('   infAdProd:', equivalence);
    }
}

checkNfeDescription().catch(console.error);
