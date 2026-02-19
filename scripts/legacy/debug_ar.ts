
import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from '../_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkArTitlesStructure() {
    console.log("Checking ar_titles constraints...");

    // We try to insert a dummy AR title linked to a sales order to see if it works or fails with FK error
    // If it fails with "relation does not exist", table is missing.
    // If it fails with FK violation, FK exists.
    // If it succeeds, FK might not exist or we used valid ID.

    // Actually, let's look for constraints via a raw query attempt if possible using a known RPC or just testing behavior.

    // I will try to select join from ar_titles and sales_documents
    const { data, error } = await supabase
        .from('ar_titles')
        .select(`
            *,
            sales_documents(*)
        `)
        .limit(1);

    if (error) {
        console.error("Join Error:", error);
    } else {
        console.log("Join Success. Rows:", data.length);
    }
}

checkArTitlesStructure();
