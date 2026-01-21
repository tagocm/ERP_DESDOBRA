#!/usr/bin/env node
/**
 * Diagnostic: Check what's actually stored for NFe #18
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Missing env vars. Run with: source .env.local && node ...');
    process.exit(1);
}

const supabase = createClient(url, key, {
    auth: { persistSession: false }
});

async function main() {
    console.log('\n=== NFe #18 Diagnostic ===\n');

    // 1. Find NFe #18 record
    const { data: nfe, error: nfeErr } = await supabase
        .from('sales_document_nfes')
        .select('*')
        .eq('nfe_number', 18)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (nfeErr || !nfe) {
        console.error('❌ NFe #18 not found:', nfeErr?.message);
        return;
    }

    console.log('✅ Found NFe record:');
    console.log('  ID:', nfe.id);
    console.log('  Document ID:', nfe.document_id);
    console.log('  Status:', nfe.status);
    console.log('  Key:', nfe.nfe_key || 'N/A');

    // 2. Check details field
    console.log('\n📋 Details structure:');
    const details = nfe.details;
    if (typeof details === 'string') {
        console.log('  ⚠️  details is a STRING (should be JSONB)');
        console.log('  Content:', details.substring(0, 200));
    } else if (details && typeof details === 'object') {
        console.log('  ✅ details is an object');
        console.log('  Keys:', Object.keys(details).join(', '));

        if (details.artifacts) {
            console.log('\n  Artifacts:');
            console.log('    xml:', details.artifacts.xml || 'N/A');
            console.log('    signed_xml:', details.artifacts.signed_xml || 'N/A');
            console.log('    protocol:', details.artifacts.protocol || 'N/A');
        } else {
            console.log('  ❌ No artifacts field in details');
        }
    } else {
        console.log('  ❌ details is null or undefined');
    }

    // 3. Try to download XML
    const xmlPath = details?.artifacts?.signed_xml || details?.artifacts?.xml;
    if (!xmlPath) {
        console.log('\n❌ No XML path found in details');
        return;
    }

    console.log('\n📥 Downloading XML from:', xmlPath);
    const { data: fileData, error: downloadErr } = await supabase.storage
        .from('company-assets')
        .download(xmlPath);

    if (downloadErr || !fileData) {
        console.error('❌ Download failed:', downloadErr?.message);
        return;
    }

    const xml = await fileData.text();
    console.log('✅ Downloaded! Size:', xml.length, 'bytes');
    console.log('\n📄 First 500 characters:');
    console.log(xml.substring(0, 500));
    console.log('\n📄 Last 200 characters:');
    console.log(xml.substring(xml.length - 200));

    // Save to file for inspection
    const outPath = '/tmp/nfe-18-debug.xml';
    fs.writeFileSync(outPath, xml);
    console.log('\n💾 Saved full XML to:', outPath);
    console.log('   You can inspect it with: cat', outPath);

    // Check structure
    console.log('\n🔍 XML Structure Check:');
    console.log('  Has <?xml declaration:', xml.startsWith('<?xml'));
    console.log('  Has <nfeProc>:', xml.includes('<nfeProc'));
    console.log('  Has <NFe>:', xml.includes('<NFe'));
    console.log('  Has <infNFe>:', xml.includes('<infNFe'));
    console.log('  Has <protNFe>:', xml.includes('<protNFe'));
}

main().catch(console.error);
