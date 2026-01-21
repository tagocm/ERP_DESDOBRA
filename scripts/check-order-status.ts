
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOrder() {
    console.log('🔍 Checking Order #91...');

    const { data: order, error } = await supabase
        .from('sales_documents')
        .select('*')
        .eq('document_number', 91)
        .single();

    if (error) {
        console.error('Error fetching order:', error);
        return;
    }

    if (!order) {
        console.error('Order #91 not found.');
        return;
    }

    console.log('--- Sales Document State ---');
    console.log(`ID: ${order.id}`);
    console.log(`Status Commercial: ${order.status_commercial}`);
    console.log(`Status Logistic: ${order.status_logistic}`);
    console.log(`Dispatch Blocked: ${order.dispatch_blocked}`);
    console.log(`Dispatch Blocked Reason: ${order.dispatch_blocked_reason}`);
    console.log(`Financial Status: ${order.financial_status}`);

    console.log('\n--- Financial Events (Audit) ---');
    const { data: events, error: eventsError } = await supabase
        .from('financial_events')
        .select('*')
        .eq('sales_document_id', order.id)
        .order('created_at', { ascending: false });

    if (eventsError) console.error('Error fetching events:', eventsError);
    else console.table(events.map(e => ({ type: e.event_type, status: e.status, desc: e.description })));

    console.log('\n--- Sales History (Audit) ---');
    const { data: history, error: historyError } = await supabase
        .from('sales_order_history')
        .select('*')
        .eq('document_id', order.id)
        .order('created_at', { ascending: false });

    if (historyError) console.error('Error fetching history:', historyError);
    else console.table(history.map(h => ({ type: h.event_type, desc: h.description, user: h.user_id })));
}

checkOrder();
