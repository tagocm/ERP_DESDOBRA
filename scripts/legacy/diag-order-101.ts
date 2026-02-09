import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagOrder101() {
    console.log('🔍 Diagnosing Order #101...\n');

    // 1. Get Order Details
    const { data: order, error: orderError } = await supabase
        .from('sales_documents')
        .select(`
      id,
      document_number,
      status_commercial,
      status_logistic,
      status_fiscal,
      financial_status,
      dispatch_blocked,
      dispatch_blocked_reason,
      dispatch_blocked_at,
      dispatch_blocked_by,
      scheduled_delivery_date,
      created_at,
      updated_at
    `)
        .eq('document_number', 101)
        .single();

    if (orderError) {
        console.error('❌ Error fetching order:', orderError);
        return;
    }

    console.log('📋 ORDER #101 STATE:');
    console.log('-------------------');
    console.log('ID:', order.id);
    console.log('Status Commercial:', order.status_commercial);
    console.log('Status Logistic:', order.status_logistic);
    console.log('Status Fiscal:', order.status_fiscal);
    console.log('Financial Status:', order.financial_status);
    console.log('Dispatch Blocked:', order.dispatch_blocked);
    console.log('Dispatch Blocked Reason:', order.dispatch_blocked_reason);
    console.log('Dispatch Blocked At:', order.dispatch_blocked_at);
    console.log('Scheduled Delivery:', order.scheduled_delivery_date);
    console.log('Updated At:', order.updated_at);
    console.log('\n');

    // 2. Get Financial Events
    const { data: events, error: eventsError } = await supabase
        .from('financial_events')
        .select('*')
        .eq('origin_id', order.id)
        .order('created_at', { ascending: false });

    if (eventsError) {
        console.error('❌ Error fetching events:', eventsError);
    } else {
        console.log('💰 FINANCIAL EVENTS:');
        console.log('-------------------');
        if (events.length === 0) {
            console.log('No financial events found.');
        } else {
            events.forEach((event, idx) => {
                console.log(`\nEvent ${idx + 1}:`);
                console.log('  ID:', event.id);
                console.log('  Status:', event.status);
                console.log('  Operational Status:', event.operational_status);
                console.log('  Created At:', event.created_at);
                console.log('  Approved At:', event.approved_at);
                console.log('  Rejected At:', event.rejected_at);
                console.log('  Rejection Reason:', event.rejection_reason);
                console.log('  Attention Reason:', event.attention_reason);
            });
        }
    }
    console.log('\n');

    // 3. Get History
    const { data: history, error: historyError } = await supabase
        .from('sales_order_history')
        .select('*')
        .eq('document_id', order.id)
        .order('created_at', { ascending: false })
        .limit(10);

    if (historyError) {
        console.error('❌ Error fetching history:', historyError);
    } else {
        console.log('📜 ORDER HISTORY (Last 10):');
        console.log('---------------------------');
        if (history.length === 0) {
            console.log('No history found.');
        } else {
            history.forEach((h, idx) => {
                console.log(`\n${idx + 1}. ${h.event_type} (${h.created_at})`);
                console.log('   Description:', h.description);
                console.log('   Metadata:', JSON.stringify(h.metadata, null, 2));
            });
        }
    }

    console.log('\n✅ Diagnosis complete.');
}

diagOrder101().catch(console.error);
