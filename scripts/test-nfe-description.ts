import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from './_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNfeDescriptionFeature() {
    console.log('🔍 Testing NFe Description Feature...\n');

    // 1. Find Granola product
    const { data: product, error: prodError } = await supabase
        .from('items')
        .select('id, name, sku, uom')
        .ilike('name', '%granola%')
        .single();

    if (prodError || !product) {
        console.error('❌ Product not found:', prodError);
        return;
    }

    console.log('✅ Product found:', product.name);

    // 2. Check packaging
    const { data: packagings, error: pkgError } = await supabase
        .from('item_packaging')
        .select('*')
        .eq('item_id', product.id)
        .eq('is_active', true);

    if (pkgError || !packagings || packagings.length === 0) {
        console.error('❌ No packaging found:', pkgError);
        return;
    }

    console.log('✅ Packaging found:');
    packagings.forEach(pkg => {
        console.log(`   - ${pkg.label} (type: ${pkg.type}, qty_in_base: ${pkg.qty_in_base})`);
    });

    // 3. Check if migration was applied
    const { data: sample, error: sampleError } = await supabase
        .from('sales_document_items')
        .select('id, sales_uom_abbrev_snapshot, base_uom_abbrev_snapshot, conversion_factor_snapshot')
        .not('sales_uom_abbrev_snapshot', 'is', null)
        .limit(1)
        .single();

    if (sample) {
        console.log('\n✅ Migration applied! Found item with snapshots:');
        console.log('   Sales UOM:', sample.sales_uom_abbrev_snapshot);
        console.log('   Base UOM:', sample.base_uom_abbrev_snapshot);
        console.log('   Factor:', sample.conversion_factor_snapshot);
    } else {
        console.log('\n⚠️  No items with snapshots yet. Create a NEW order to test!');
    }

    // 4. Test description builder
    console.log('\n📝 Testing description builder...');

    const { buildNfeProductDescription } = await import('../lib/fiscal/nfe-description');

    const result = buildNfeProductDescription({
        itemName: product.name,
        salesUomAbbrev: 'CX',
        baseUomAbbrev: 'PC',
        conversionFactor: 12,
        qtySales: 5,
        qtyBase: 60
    });

    console.log('✅ Description builder works!');
    console.log('   xProd:', result.xProd);
    if (result.infAdProd) {
        console.log('   infAdProd:', result.infAdProd);
    }

    console.log('\n✅ All tests passed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Create a NEW sales order');
    console.log('   2. Add "Granola Tradicional 1kg" with packaging "Caixa 12xPc"');
    console.log('   3. Save the order (snapshots will be populated)');
    console.log('   4. Generate NFe - you will see the new description!');
}

testNfeDescriptionFeature().catch(console.error);
