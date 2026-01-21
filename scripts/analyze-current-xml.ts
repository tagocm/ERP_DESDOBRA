import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function downloadAndAnalyze() {
    const xmlPath = 'nfe/dcda30de-0f1f-430f-a047-00d957663855/2eebb2d0-0367-4b39-82a0-ba2ec30e5d51/nfe.xml';

    const { data, error } = await supabase.storage
        .from('nfe-artifacts')
        .download(xmlPath);

    if (error) {
        console.error('Download error:', error);
        return;
    }

    const xml = await data.text();

    // Save
    fs.writeFileSync('/tmp/order-95-current.xml', xml);
    console.log('✅ XML saved to /tmp/order-95-current.xml\n');

    // Extract <det> section
    const detMatch = xml.match(/<det[^>]*>([\s\S]*?)<\/det>/);
    if (detMatch) {
        console.log('📦 <det> section:\n');
        // Pretty print
        const detSection = detMatch[0];
        const formatted = detSection
            .replace(/></g, '>\n<')
            .split('\n')
            .map(line => line.trim())
            .join('\n  ');
        console.log(formatted);
    }

    // Check for CEST
    if (xml.includes('<CEST>')) {
        console.log('\n⚠️ FOUND <CEST> tag!');
    } else {
        console.log('\n✅ No <CEST> tag');
    }

    // Check for infAdProd
    if (xml.includes('<infAdProd>')) {
        console.log('⚠️ FOUND <infAdProd> tag!');
    } else {
        console.log('✅ No <infAdProd> tag');
    }
}

downloadAndAnalyze();
