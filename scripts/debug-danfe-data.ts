#!/usr/bin/env tsx
/**
 * Debug script to check what data exists for DANFE generation
 */

import { createAdminClient } from '../lib/supabaseServer';

async function main() {
    const supabase = createAdminClient();

    console.log('\n=== DANFE Data Debug ===\n');

    // 1. Check sales_document_nfes for NF-e #18
    console.log('1. Checking sales_document_nfes for NF-e #18...');
    const { data: nfeRecords, error: nfeError } = await supabase
        .from('sales_document_nfes')
        .select('id, document_id, nfe_number, nfe_series, nfe_key, status, issued_at')
        .eq('nfe_number', 18)
        .order('created_at', { ascending: false });

    if (nfeError) {
        console.error('❌ Error:', nfeError);
        return;
    }

    console.log(`Found ${nfeRecords?.length || 0} records:`);
    nfeRecords?.forEach(nfe => {
        console.log(`  - ID: ${nfe.id}`);
        console.log(`    Document ID: ${nfe.document_id}`);
        console.log(`    Number/Series: ${nfe.nfe_number}/${nfe.nfe_series}`);
        console.log(`    Status: ${nfe.status}`);
        console.log(`    Key: ${nfe.nfe_key || 'N/A'}`);
        console.log('');
    });

    if (!nfeRecords || nfeRecords.length === 0) {
        console.log('⚠️ No records found in sales_document_nfes for NF-e #18');
        return;
    }

    // 2. For each NFe record, check if there's a corresponding emission
    console.log('\n2. Checking nfe_emissions for each document_id...');
    for (const nfe of nfeRecords) {
        const { data: emissions, error: emissionError } = await supabase
            .from('nfe_emissions')
            .select('id, access_key, status, numero, serie, sales_document_id, xml_nfe_proc, xml_signed')
            .eq('sales_document_id', nfe.document_id)
            .order('created_at', { ascending: false });

        console.log(`\n  Document ID: ${nfe.document_id}`);
        if (emissionError) {
            console.error(`  ❌ Error: ${emissionError.message}`);
        } else if (!emissions || emissions.length === 0) {
            console.log(`  ⚠️ No emission records found`);
        } else {
            console.log(`  ✅ Found ${emissions.length} emission(s):`);
            emissions.forEach(e => {
                console.log(`    - ID: ${e.id}`);
                console.log(`      Access Key: ${e.access_key}`);
                console.log(`      Number/Series: ${e.numero}/${e.serie}`);
                console.log(`      Status: ${e.status}`);
                console.log(`      Has xml_nfe_proc: ${!!e.xml_nfe_proc}`);
                console.log(`      Has xml_signed: ${!!e.xml_signed}`);
            });
        }
    }

    // 3. Also check if there are ANY emissions at all
    console.log('\n3. Checking all nfe_emissions (latest 5)...');
    const { data: allEmissions, error: allError } = await supabase
        .from('nfe_emissions')
        .select('id, numero, serie, status, sales_document_id, access_key')
        .order('created_at', { ascending: false })
        .limit(5);

    if (allError) {
        console.error('❌ Error:', allError);
    } else {
        console.log(`Total count (latest 5):`);
        allEmissions?.forEach(e => {
            console.log(`  - NF-e ${e.numero}/${e.serie} - Status: ${e.status} - Doc ID: ${e.sales_document_id || 'NULL'}`);
        });
    }
}

main().catch(console.error);
