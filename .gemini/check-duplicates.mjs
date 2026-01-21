// Script to check for duplicate clients in the database
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
    console.log('🔍 Checking for duplicate clients...\n');

    // Get all organizations
    const { data: orgs, error } = await supabase
        .from('organizations')
        .select('id, trade_name, document_number, created_at, company_id')
        .is('deleted_at', null)
        .order('trade_name');

    if (error) {
        console.error('Error fetching organizations:', error);
        return;
    }

    console.log(`Found ${orgs.length} total clients\n`);

    // Check for duplicate trade names
    const tradeNameMap = new Map();
    orgs.forEach(org => {
        const key = org.trade_name?.toLowerCase().trim();
        if (!key) return;

        if (!tradeNameMap.has(key)) {
            tradeNameMap.set(key, []);
        }
        tradeNameMap.get(key).push(org);
    });

    const duplicateTradeNames = Array.from(tradeNameMap.entries())
        .filter(([_, orgs]) => orgs.length > 1);

    if (duplicateTradeNames.length > 0) {
        console.log('❌ DUPLICATE TRADE NAMES FOUND:\n');
        duplicateTradeNames.forEach(([name, orgs]) => {
            console.log(`📋 "${name}" (${orgs.length} entries):`);
            orgs.forEach(org => {
                console.log(`   - ID: ${org.id}`);
                console.log(`     Document: ${org.document_number || 'N/A'}`);
                console.log(`     Created: ${org.created_at}`);
                console.log('');
            });
        });
    } else {
        console.log('✅ No duplicate trade names found\n');
    }

    // Check for duplicate document numbers
    const docMap = new Map();
    orgs.forEach(org => {
        if (!org.document_number) return;
        const key = org.document_number.replace(/\D/g, ''); // Remove non-digits
        if (!key) return;

        if (!docMap.has(key)) {
            docMap.set(key, []);
        }
        docMap.get(key).push(org);
    });

    const duplicateDocs = Array.from(docMap.entries())
        .filter(([_, orgs]) => orgs.length > 1);

    if (duplicateDocs.length > 0) {
        console.log('\n❌ DUPLICATE DOCUMENT NUMBERS FOUND:\n');
        duplicateDocs.forEach(([doc, orgs]) => {
            console.log(`📄 Document: ${doc} (${orgs.length} entries):`);
            orgs.forEach(org => {
                console.log(`   - ID: ${org.id}`);
                console.log(`     Name: ${org.trade_name}`);
                console.log(`     Created: ${org.created_at}`);
                console.log('');
            });
        });
    } else {
        console.log('✅ No duplicate document numbers found\n');
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`Total clients: ${orgs.length}`);
    console.log(`Duplicate trade names: ${duplicateTradeNames.length}`);
    console.log(`Duplicate documents: ${duplicateDocs.length}`);

    if (duplicateTradeNames.length > 0 || duplicateDocs.length > 0) {
        console.log('\n⚠️  You have duplicates in your database that should be merged.');
    } else {
        console.log('\n✅ No duplicates found!');
    }
}

checkDuplicates().catch(console.error);
