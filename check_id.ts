
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkId() {
    const id = 'a46e2fba-35dd-485e-b996-098f98738e35';
    console.log(`Checking ID: ${id}`);

    const { data: order } = await supabase.from('sales_documents').select('*').eq('id', id).single();
    if (order) {
        console.log('Found in sales_documents:', order.document_number, order.doc_type);
        return;
    }

    const { data: routeOrder } = await supabase.from('delivery_route_orders').select('*').eq('id', id).single();
    if (routeOrder) {
        console.log('Found in delivery_route_orders:', routeOrder);
        return;
    }

    console.log('ID not found in orders or route_orders');
}

checkId();
