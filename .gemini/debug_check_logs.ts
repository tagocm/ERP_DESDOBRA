
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLogs() {
    console.log('Checking route_event_logs...');

    // Assuming delivery_route_events or similar table?
    // Let's check available tables first if unsure.
    // Actually, I looked at the file list earlier: 20260105110000_refine_delivery_events.sql
    // It likely has `delivery_route_events`.

    const { data, error } = await supabase
        .from('delivery_route_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Logs:', data);
    }
}

checkLogs();
