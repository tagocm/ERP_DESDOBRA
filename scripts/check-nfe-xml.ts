#!/usr/bin/env tsx
/**
 * Quick check of what XML we're actually getting from storage
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get NFe #18
    const { data: nfe } = await supabase
        .from('sales_document_nfes')
        .select('id, nfe_number, details')
        .eq('nfe_number', 18)
        .single();

    if (!nfe) {
        console.log('NFe #18 not found');
        return;
    }

    console.log('NFe ID:', nfe.id);
    console.log('Details:', JSON.stringify(nfe.details, null, 2));

    const details = nfe.details as any;
    const xmlPath = details?.artifacts?.signed_xml || details?.artifacts?.xml;

    if (!xmlPath) {
        console.log('No XML path in details');
        return;
    }

    console.log('\nDownloading from:', xmlPath);

    const { data: fileData, error } = await supabase.storage
        .from('company-assets')
        .download(xmlPath);

    if (error) {
        console.error('Download error:', error);
        return;
    }

    const xml = await fileData.text();
    console.log('\nXML length:', xml.length);
    console.log('First 500 chars:', xml.substring(0, 500));
    console.log('\nLast 300 chars:', xml.substring(xml.length - 300));
}

main().catch(console.error);
