import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagReconfirmation() {
    console.log('🔍 Diagnosing re-confirmation issue...\n');

    // Check for recently created pending events
    const { data: events } = await supabase
        .from('financial_events')
        .select(`
      id,
      origin_reference,
      partner_name,
      total_amount,
      status,
      operational_status,
      created_at
    `)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
        .limit(10);

    if (!events || events.length === 0) {
        console.log('❌ NO PENDING events found at all!');
        return;
    }

    console.log(`Found ${events.length} pending events:\n`);
    events.forEach((e, idx) => {
        console.log(`${idx + 1}. ${e.origin_reference}`);
        console.log(`   Partner: ${e.partner_name}`);
        console.log(`   Amount: R$ ${e.total_amount}`);
        console.log(`   Status: ${e.status}`);
        console.log(`   Operational: ${e.operational_status}`);
        console.log(`   Created: ${e.created_at}`);
        console.log('');
    });

    // Check what the approval list API would return
    console.log('\n🔍 Simulating approval list query...\n');

    const { data: approvalList, error } = await supabase
        .from('financial_events')
        .select('*')
        .in('status', ['pendente', 'em_atencao'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Would show ${approvalList?.length || 0} events in approval list`);
    }
}

diagReconfirmation().catch(console.error);
