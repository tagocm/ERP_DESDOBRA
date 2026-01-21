import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateBuggyEvent() {
    console.log('🔍 Investigating financial event for Order #99901...\n');

    // Get the order
    const { data: order } = await supabase
        .from('sales_documents')
        .select('*')
        .eq('document_number', 99901)
        .single();

    if (!order) {
        console.log('Order not found');
        return;
    }

    console.log('📋 ORDER #99901:');
    console.log('  ID:', order.id);
    console.log('  Client ID:', order.client_id);
    console.log('  Total:', order.total_amount);
    console.log('  Date Issued:', order.date_issued);
    console.log('  Payment Condition:', order.payment_condition_id);
    console.log('\n');

    // Get the financial event
    const { data: events } = await supabase
        .from('financial_events')
        .select('*')
        .eq('origin_id', order.id)
        .eq('origin_type', 'SALE')
        .order('created_at', { ascending: false });

    if (!events || events.length === 0) {
        console.log('No financial events found');
        return;
    }

    console.log('💰 FINANCIAL EVENTS:');
    events.forEach((event, idx) => {
        console.log(`\nEvent ${idx + 1} (${event.status}):`);
        console.log('  ID:', event.id);
        console.log('  Partner ID:', event.partner_id);
        console.log('  Partner Name:', event.partner_name);
        console.log('  Payment Condition ID:', event.payment_condition_id);
        console.log('  Total Amount:', event.total_amount);
        console.log('  Issue Date:', event.issue_date);
        console.log('  Operational Status:', event.operational_status);
        console.log('  Created At:', event.created_at);
    });

    // Compare with a good event
    console.log('\n\n📊 Comparing with a normal financial event...\n');

    const { data: goodEvents } = await supabase
        .from('financial_events')
        .select('*')
        .eq('status', 'aprovado')
        .limit(1);

    if (goodEvents && goodEvents.length > 0) {
        const good = goodEvents[0];
        const bad = events[0];

        console.log('GOOD EVENT has these fields:');
        Object.keys(good).forEach(key => {
            if (good[key] !== null && good[key] !== undefined) {
                console.log(`  ✅ ${key}: ${typeof good[key]}`);
            }
        });

        console.log('\nBAD EVENT missing fields:');
        Object.keys(good).forEach(key => {
            if ((good[key] !== null && good[key] !== undefined) &&
                (bad[key] === null || bad[key] === undefined)) {
                console.log(`  ❌ ${key}`);
            }
        });
    }
}

investigateBuggyEvent().catch(console.error);
