import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEventWithInstallments() {
    console.log('🔍 Checking Pedido #99901 with installments...\n');

    // Mimic the exact query from listPendingEvents
    const { data, error } = await supabase
        .from('financial_events')
        .select(`
      *,
      origin_type,
      origin_id,
      installments:financial_event_installments(*)
    `)
        .eq('origin_reference', 'Pedido #99901')
        .in('status', ['pendente', 'em_atencao']); if (error) {
            console.error('Error:', error);
            return;
        }

    if (!data || data.length === 0) {
        console.log('❌ No events found with that query');
        return;
    }

    const event = data[0];
    console.log('Event found:');
    console.log('  ID:', event.id);
    console.log('  Reference:', event.origin_reference);
    console.log('  Partner:', event.partner_name);
    console.log('  Amount:', event.total_amount);
    console.log('  Status:', event.status);
    console.log('  Company ID:', event.company_id);
    console.log('\n');

    if (!event.installments || event.installments.length === 0) {
        console.log('❌ NO INSTALLMENTS!');
        console.log('This event will appear broken/buggy in the UI');
    } else {
        console.log(`✅ Has ${event.installments.length} installment(s):`);
        event.installments.forEach((inst: any) => {
            console.log(`  - Installment #${inst.installment_number}: R$ ${inst.amount}, due ${inst.due_date}`);
        });
    }
}

checkEventWithInstallments().catch(console.error);
