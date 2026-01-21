import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSnapshotLogic() {
    console.log('🧪 Testing Snapshot Population Logic\n');

    // Get the latest item with packaging
    const { data: item } = await supabase
        .from('sales_document_items')
        .select('id, packaging_id, item_id, sales_uom_abbrev_snapshot')
        .not('packaging_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!item) {
        console.log('No items with packaging found');
        return;
    }

    console.log('Testing with item:', item.id);
    console.log('  packaging_id:', item.packaging_id);
    console.log('  current snapshot:', item.sales_uom_abbrev_snapshot);

    // Test the conditional
    const shouldPopulate = item.packaging_id && !item.sales_uom_abbrev_snapshot;
    console.log('\nConditional check:');
    console.log('  packaging_id exists:', !!item.packaging_id);
    console.log('  snapshot is null/undefined:', !item.sales_uom_abbrev_snapshot);
    console.log('  SHOULD POPULATE:', shouldPopulate);

    if (!shouldPopulate) {
        console.log('\n⚠️  ISSUE: Conditional prevents execution!');
        console.log('    Snapshot value:', JSON.stringify(item.sales_uom_abbrev_snapshot));
        console.log('    Type:', typeof item.sales_uom_abbrev_snapshot);
        return;
    }

    // Test packaging fetch
    console.log('\n📦 Testing packaging fetch...');
    const { data: packaging, error: pkgError } = await supabase
        .from('item_packaging')
        .select('qty_in_base, label, type')
        .eq('id', item.packaging_id)
        .single();

    if (pkgError) {
        console.log('❌ Packaging fetch ERROR:', pkgError.message);
        return;
    }

    console.log('✅ Packaging fetched:', packaging?.label);
    console.log('   Type:', packaging?.type);
    console.log('   qty_in_base:', packaging?.qty_in_base);
    console.log('   UOMs:', packaging);

    // Test item fetch
    console.log('\n📝 Testing item UOM fetch...');
    const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('uom')
        .eq('id', item.item_id)
        .single();

    if (itemError) {
        console.log('❌ Item fetch ERROR:', itemError.message);
        return;
    }

    console.log('✅ Item fetched');
    console.log('   uom:', itemData?.uom);
    console.log('   UOMs:', itemData);

    console.log('\n✅ All queries work - logic should execute!');
    console.log('\n💡 Next step: Check why upsertSalesItem is not calling this code');
}

testSnapshotLogic().catch(console.error);
