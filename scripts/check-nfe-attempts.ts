import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: order } = await supabase
        .from('sales_documents')
        .select('id')
        .eq('document_number', 95)
        .single();

    if (!order) {
        console.log('Order #95 not found');
        return;
    }

    console.log('Checking NFe attempts for order:', order.id);

    const { data: nfes } = await supabase
        .from('sales_document_nfes')
        .select('*')
        .eq('document_id', order.id)
        .order('created_at', { ascending: false });

    if (!nfes || nfes.length === 0) {
        console.log('\n❌ NO NFE ATTEMPTS');
        return;
    }

    console.log(`\n✅ Found ${nfes.length} attempt(s):\n`);

    nfes.forEach((nfe: any, i) => {
        console.log(`Attempt ${i + 1}:`);
        console.log(`  ID: ${nfe.id}`);
        console.log(`  Status: ${nfe.status}`);
        console.log(`  Created: ${nfe.created_at}`);
        console.log(`  Updated: ${nfe.updated_at}`);
        console.log(`  Details:`, JSON.stringify(nfe.details, null, 2));
        console.log('');
    });
}

check();
