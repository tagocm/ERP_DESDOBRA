import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from '../_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    // Get order #95 item
    const { data: order } = await supabase
        .from('sales_documents')
        .select('id')
        .eq('document_number', 95)
        .single();

    const { data: items } = await supabase
        .from('sales_document_items')
        .select(`
      id,
      packaging_id,
      packaging:item_packaging(id, label, type, qty_in_base)
    `)
        .eq('document_id', order.id);

    console.log('Items do pedido #95:');
    items?.forEach((item: any) => {
        console.log('\nItem:', item.id);
        console.log('  Packaging ID:', item.packaging_id);
        if (item.packaging) {
            console.log('  Label:', `"${item.packaging.label}"`);
            console.log('  Label length:', item.packaging.label?.length);
            console.log('  Label bytes:', Buffer.from(item.packaging.label || '').toString('hex'));
            console.log('  Type:', `"${item.packaging.type}"`);
            console.log('  Type length:', item.packaging.type?.length);
        }
    });
}

debug();
