
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

async function checkOrder67() {
    console.log("--- Checking Order #67 ---");
    const { data: order, error } = await supabase
        .from('sales_documents')
        .select(`
            id, document_number, status_commercial, doc_type, deleted_at, created_at
        `)
        .eq('document_number', 67);

    if (order && order.length > 0) {
        console.log("Found Order #67:", order);
    } else {
        console.log("Order #67 NOT FOUND.");
        // Check if there are any gaps in sequences
        const { data: recent } = await supabase.from('sales_documents')
            .select('document_number, created_at')
            .not('document_number', 'is', null)
            .order('document_number', { ascending: false })
            .limit(5);
        console.log("Recent Orders:", recent);
    }
}

checkOrder67();
