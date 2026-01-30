
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrder48() {
    console.log('--- Checking Order #48 ---');

    const { data: orders, error } = await supabase
        .from('sales_documents')
        .select('id, document_number, company_id, doc_type, status_commercial')
        .eq('document_number', 48);

    if (error) { console.error('Error:', error); return; }

    console.log(`Found ${orders.length} orders with #48:`);
    console.log(orders);
}

checkOrder48();
