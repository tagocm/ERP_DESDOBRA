
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugQuery() {
    const id = '4de5d1ac-899f-409c-9713-430972c367b9';
    const companyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

    console.log(`Debug Query for PO: ${id}`);

    const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
            *,
            supplier:organizations!supplier_id(id, name:trade_name, document:document_number, trade_name, email, phone),
            items:purchase_order_items(
                *,
                item:items(
                    id, 
                    name, 
                    uom, 
                    sku
                )
            )
        `)
        .eq('company_id', companyId)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Query Failed!');
        console.error('Code:', error.code);
        console.error('Message:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
    } else {
        console.log('Query Successful!');
        console.log(JSON.stringify(data, null, 2));
    }
}

debugQuery();
