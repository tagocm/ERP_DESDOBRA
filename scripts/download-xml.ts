import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

import { supabaseUrl } from './_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function download() {
    // Download latest XML
    const xmlPath = 'nfe/dcda30de-0f1f-430f-a047-00d957663855/33649ae3-4e51-4d57-bf16-9f8082711f2f/nfe.xml';

    console.log('Downloading:', xmlPath);

    const { data, error } = await supabase.storage
        .from('nfe-artifacts')
        .download(xmlPath);

    if (error) {
        console.error('Error:', error);
        return;
    }

    const xmlText = await data.text();

    // Save to file
    fs.writeFileSync('/tmp/order-95-latest.xml', xmlText);
    console.log('\n✅ Saved to /tmp/order-95-latest.xml');

    // Extract product section
    const prodMatch = xmlText.match(/<det[^>]*>[\s\S]*?<\/det>/);
    if (prodMatch) {
        console.log('\n📦 PRODUCT SECTION:\n');
        console.log(prodMatch[0]);
    }
}

download();
