
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPO() {
    const id = '4de5d1ac-899f-409c-9713-430972c367b9';
    console.log(`Checking PO ID: ${id}`);

    const { data: po, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error('Error fetching PO:', error);
        return;
    }

    if (!po) {
        console.log('PO NOT FOUND in database.');
    } else {
        console.log('PO Found:');
        console.log('ID:', po.id);
        console.log('Company ID:', po.company_id);
        console.log('Status:', po.status);
        console.log('Deleted At:', po.deleted_at);
    }
}

checkPO();
