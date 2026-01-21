
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraint() {
    console.log('Checking constraint...');
    // We can't query information_schema via Supabase JS client easily (unless creating a wrapper view), 
    // so we'll try to insert a duplicate to check if it fails.

    // 1. Get an existing route order
    const { data: existing, error } = await supabase.from('delivery_route_orders').select('*').limit(1).single();

    if (!existing) {
        console.log('No data to test with.');
        return;
    }

    console.log(`Trying to duplicate: Route ${existing.route_id}, Order ${existing.sales_document_id}`);

    // 2. Try to insert exact same
    const { error: insertError } = await supabase.from('delivery_route_orders').insert({
        company_id: existing.company_id,
        route_id: existing.route_id,
        sales_document_id: existing.sales_document_id,
        position: 999
    });

    if (insertError) {
        console.log('Insert failed (Expected if constraint exists):');
        console.log(insertError.message);
        console.log(insertError.details);
    } else {
        console.log('!!! INSERT SUCCESSFUL !!! CONSTRAINT IS MISSING !!!');
        // Clean up
        await supabase.from('delivery_route_orders').delete().match({
            route_id: existing.route_id,
            sales_document_id: existing.sales_document_id,
            position: 999
        });
    }
}

checkConstraint();
