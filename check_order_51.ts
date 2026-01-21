
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

async function checkCancelled() {
    console.log("Searching for Cancelled Sales Orders...");
    const { data: sales } = await supabase
        .from('sales_documents')
        .select('id, document_number, status_commercial')
        .eq('status_commercial', 'cancelled')
        .limit(5);
    console.log("Cancelled Sales:", sales);
}
checkCancelled();
