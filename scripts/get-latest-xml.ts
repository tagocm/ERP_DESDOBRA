import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from './_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: order } = await supabase
        .from('sales_documents')
        .select('id')
        .eq('document_number', 95)
        .single();

    if (!order) {
        console.log('Order not found');
        return;
    }

    // Get most recent NFe attempt
    const { data: nfe } = await supabase
        .from('sales_document_nfes')
        .select('*')
        .eq('document_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!nfe) {
        console.log('No NFe found');
        return;
    }

    console.log('Latest NFe attempt:');
    console.log('  ID:', nfe.id);
    console.log('  Status:', nfe.status);
    console.log('  Created:', nfe.created_at);
    console.log('  Key:', nfe.nfe_key);
    console.log('\nDetails:', JSON.stringify(nfe.details, null, 2));

    // Try to get XML
    const xmlPath = nfe.details?.artifacts?.xml;
    if (xmlPath) {
        console.log('\nXML Path:', xmlPath);
        console.log('Attempting to download...');

        // Try with public URL
        const publicUrl = supabase.storage
            .from('nfe-artifacts')
            .getPublicUrl(xmlPath);

        console.log('Public URL:', publicUrl.data.publicUrl);
    }
}

check();
