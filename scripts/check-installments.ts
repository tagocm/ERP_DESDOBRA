import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInstallments() {
    console.log('🔍 Checking if Order #99901 event has installments...\n');

    // Get the event
    const { data: event } = await supabase
        .from('financial_events')
        .select('id')
        .eq('origin_reference', 'PV-99901')
        .single();

    if (!event) {
        console.log('Event not found');
        return;
    }

    console.log('Event ID:', event.id);
    console.log('\n');

    // Get installments
    const { data: installments } = await supabase
        .from('financial_event_installments')
        .select('*')
        .eq('event_id', event.id);

    if (!installments || installments.length === 0) {
        console.log('❌ NO INSTALLMENTS FOUND');
        console.log('This is the problem! The event was created without installments.');
    } else {
        console.log(`✅ Found ${installments.length} installment(s):`);
        installments.forEach((inst, idx) => {
            console.log(`\n  Installment ${idx + 1}:`);
            console.log('    Number:', inst.installment_number);
            console.log('    Amount:', inst.amount);
            console.log('    Due Date:', inst.due_date);
            console.log('    Payment Condition:', inst.payment_condition);
        });
    }
}

checkInstallments().catch(console.error);
