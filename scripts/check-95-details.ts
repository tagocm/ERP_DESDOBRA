import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from './_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: order } = await supabase
        .from('sales_documents')
        .select('id, document_number, created_at')
        .eq('document_number', 95)
        .single();

    if (!order) {
        console.log('Order not found');
        return;
    }

    console.log(`Order #95 created at: ${order.created_at}`);

    const { data: items } = await supabase
        .from('sales_document_items')
        .select(`
      *,
      product:items!item_id(name)
    `)
        .eq('document_id', order.id);

    console.log('\nItems:');
    items?.forEach((item: any) => {
        console.log(`\n  ${item.product.name}`);
        console.log(`    created_at: ${item.created_at}`);
        console.log(`    packaging_id: ${item.packaging_id}`);
        console.log(`    sales_uom_abbrev_snapshot: ${item.sales_uom_abbrev_snapshot || 'NULL'}`);
        console.log(`    base_uom_abbrev_snapshot: ${item.base_uom_abbrev_snapshot || 'NULL'}`);
        console.log(`    conversion_factor_snapshot: ${item.conversion_factor_snapshot || 'NULL'}`);
    });
}

check();
