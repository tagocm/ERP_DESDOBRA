
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkOrder99() {
    console.log('🔍 Checking Order #99...');

    // 1. Get Order State
    const { data: order, error } = await supabase
        .from('sales_documents')
        .select('*')
        .eq('document_number', 99)
        .single();

    if (error) {
        console.error('Error fetching order:', error);
        return;
    }

    if (!order) {
        console.error('Order #99 not found.');
        return;
    }

    console.log('--- Sales Document State ---');
    console.log(`ID: ${order.id}`);
    console.log(`Status Commercial: ${order.status_commercial} (Expected: draft)`);
    console.log(`Status Logistic: ${order.status_logistic} (Expected: pendente)`);
    console.log(`Dispatch Blocked: ${order.dispatch_blocked} (Expected: true)`);
    console.log(`Dispatch Blocked Reason: ${order.dispatch_blocked_reason}`);
    console.log(`Financial Status: ${order.financial_status}`);

    // 2. Check Financial Events
    console.log('\n--- Financial Events (Linked) ---');
    const { data: events } = await supabase
        .from('financial_events')
        .select('*')
        .or(`origin_id.eq.${order.id},notes.ilike.%${99}%`)
        .order('created_at', { ascending: false });

    console.table(events?.map(e => ({
        id: e.id,
        desc: e.description, // or rejection_reason
        status: e.status,
        rejection_reason: e.rejection_reason,
        origin_type: e.origin_type,
        origin_id: e.origin_id
    })));

    // 3. Check Sales History
    console.log('\n--- Sales History (Audit) ---');
    const { data: history } = await supabase
        .from('sales_order_history')
        .select('*')
        .eq('document_id', order.id)
        .order('created_at', { ascending: false });

    console.table(history?.map(h => ({
        type: h.event_type,
        desc: h.description,
        created_at: h.created_at
    })));
}

checkOrder99();
