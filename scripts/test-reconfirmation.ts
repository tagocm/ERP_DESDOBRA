import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testReconfirmation() {
    console.log('🧪 Testing Re-confirmation Flow with Order #101...\n');

    // Get Order #101 ID
    const { data: order } = await supabase
        .from('sales_documents')
        .select('id, document_number')
        .eq('document_number', 101)
        .single();

    if (!order) {
        console.error('❌ Order #101 not found');
        return;
    }

    console.log('📋 Order #101 ID:', order.id);
    console.log('\n');

    // Simulate the batch approval call
    console.log('🔄 Simulating batch approval...\n');

    const response = await fetch('http://localhost:3000/api/sales/approve-batch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: [order.id] }),
    });

    const result = await response.json();

    console.log('API Response:', result);
    console.log('\n');

    if (!response.ok) {
        console.error('❌ API call failed');
        return;
    }

    // Wait a moment for database to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the changes
    console.log('✅ Verifying changes...\n');

    const { data: updatedOrder } = await supabase
        .from('sales_documents')
        .select(`
      status_commercial,
      status_logistic,
      financial_status,
      dispatch_blocked,
      dispatch_blocked_reason,
      doc_type
    `)
        .eq('id', order.id)
        .single();

    console.log('📋 ORDER STATE:');
    console.log('  Status Commercial:', updatedOrder?.status_commercial, updatedOrder?.status_commercial === 'confirmed' ? '✅' : '❌');
    console.log('  Status Logistic:', updatedOrder?.status_logistic, updatedOrder?.status_logistic === 'pendente' ? '✅' : '❌');
    console.log('  Doc Type:', updatedOrder?.doc_type, updatedOrder?.doc_type === 'order' ? '✅' : '❌');
    console.log('  Dispatch Blocked:', updatedOrder?.dispatch_blocked, updatedOrder?.dispatch_blocked === false ? '✅' : '❌');
    console.log('  Financial Status:', updatedOrder?.financial_status, updatedOrder?.financial_status === 'pendente' ? '✅' : '❌');
    console.log('\n');

    // Check financial events
    const { data: events } = await supabase
        .from('financial_events')
        .select('id, status, created_at, operational_status')
        .eq('origin_id', order.id)
        .eq('origin_type', 'SALE')
        .order('created_at', { ascending: false });

    console.log('💰 FINANCIAL EVENTS:');
    if (events && events.length > 0) {
        events.forEach((event, idx) => {
            console.log(`\n  Event ${idx + 1}:`);
            console.log('    ID:', event.id);
            console.log('    Status:', event.status);
            console.log('    Operational Status:', event.operational_status);
            console.log('    Created:', event.created_at);
        });

        const pendingEvent = events.find(e => e.status === 'pendente');
        if (pendingEvent) {
            console.log('\n  ✅ Pending financial event found!');
        } else {
            console.log('\n  ❌ No pending financial event found');
        }
    } else {
        console.log('  ❌ No financial events found');
    }

    console.log('\n✅ Test complete!');
}

testReconfirmation().catch(console.error);
