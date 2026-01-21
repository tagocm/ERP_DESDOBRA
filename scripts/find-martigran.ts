import { createAdminClient } from '../lib/supabaseServer';

async function findMartigran() {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('organizations')
        .select('id, name, legal_name, trade_name, document_number, ie, ie_source, ie_last_checked_at')
        .or('legal_name.ilike.%martigran%,trade_name.ilike.%martigran%,name.ilike.%martigran%')
        .limit(5);

    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    console.log('Found organizations matching "Martigran":');
    console.log(JSON.stringify(data, null, 2));

    if (data && data.length > 0) {
        console.log('\n✅ To test IE lookup, run:');
        console.log(`CAD_DEBUG=1 npm run sync-client-ie -- --org-id=${data[0].id}`);
    }
}

findMartigran();
