
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    try {
        const envPath = path.resolve(__dirname, '.env.local');
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key?.trim() === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value.trim();
            if (key?.trim() === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = value.trim();
        });
    } catch (e) { }
}
const supabase = createClient(supabaseUrl!, serviceKey!);

async function checkOrder64() {
    console.log("--- Checking Order #64 ---");
    const { data: order, error } = await supabase
        .from('sales_documents')
        .select(`
            *,
            client:organizations!client_id(trade_name)
        `)
        .eq('document_number', 64);

    if (error) {
        console.error("Error:", error.message);
    } else if (order && order.length > 0) {
        console.log(`Found ${order.length} Orders for #64:`);
        order.forEach((o: any) => {
            console.log(`- ID: ${o.id} | Client: ${o.client?.trade_name} | Status: ${o.status_commercial} | Type: ${o.doc_type}`);
        });
    } else {
        console.log("Order #64 NOT FOUND.");
        // Check MAX
        const { data: maxOrder } = await supabase.from('sales_documents')
            .select('document_number')
            .not('document_number', 'is', null)
            .order('document_number', { ascending: false })
            .limit(1)
            .single();
        if (maxOrder) console.log(`Current Max Order: #${maxOrder.document_number}`);
    }
}

checkOrder64();
