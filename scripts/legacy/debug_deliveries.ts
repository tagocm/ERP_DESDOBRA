
import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from '../_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDeliveriesStructure() {
    console.log("Checking deliveries columns...");

    // We can't query information_schema directly with the JS client via standard table methods easily unless exposed.
    // So we'll try to insert a dummy record with 'created_by' and see the specific error.

    // Actually, let's use the RPC trick or just a raw query if we had one.
    // Let's use the 'columns' query workaround via a custom function if possible?
    // No, I'll just try to select * from deliveries limit 1 and print keys.

    const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error selecting:", error);
    } else if (data.length > 0) {
        console.log("Columns found:", Object.keys(data[0]));
    } else {
        console.log("No rows in deliveries, can't infer columns from select *.");
        // Try insert dummy to see if it complains about column missing
        console.log("Attempting specific insert to probe column...");
        const dummyId = '00000000-0000-0000-0000-000000000000'; // Invalid ref but good for column check
        const { error: insertError } = await supabase.from('deliveries').insert({
            id: '11111111-1111-1111-1111-111111111111',
            company_id: 'b826b0d1-bee5-4d47-bef3-a70a064a6569',
            sales_document_id: '8c87b21e-f10a-44c9-8da7-53c27dc922ce', // Existing doc from previous debug
            number: 999,
            created_by: '1e18ff6c-3a97-4b19-ba60-a6cc0971a31b' // Existing user
        });
        console.log("Insert result error:", insertError);
    }
}

checkDeliveriesStructure();
