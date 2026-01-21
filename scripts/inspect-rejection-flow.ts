import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectRejectionFlow() {
    console.log('🔍 Inspecting rejection flow logic...\n');

    const { data: order } = await supabase
        .from('sales_documents')
        .select('*')
        .eq('document_number', 101)
        .single();

    if (!order) {
        console.error('Order not found');
        return;
    }

    console.log('Order ID:', order.id);
    console.log('Status Logistic:', order.status_logistic);
    console.log('Status Fiscal:', order.status_fiscal);
    console.log('\n');

    // Replicate the condition from lines 49-51
    const isPostDelivery =
        ['entregue', 'devolvido', 'parcial'].includes(order.status_logistic) ||
        order.status_fiscal === 'authorized';

    console.log('🔧 FLOW DETERMINATION:');
    console.log('----------------------');
    console.log('isPostDelivery:', isPostDelivery);
    console.log('  - status_logistic in [entregue, devolvido, parcial]?',
        ['entregue', 'devolvido', 'parcial'].includes(order.status_logistic));
    console.log('  - status_fiscal === "authorized"?',
        order.status_fiscal === 'authorized');
    console.log('\n');

    if (isPostDelivery) {
        console.log('❌ PROBLEM: Order is being treated as POST-DELIVERY');
        console.log('   This means the pre-delivery update logic (lines 121-146) was NOT executed.');
        console.log('   Instead, the post-delivery "Bomba de Amanhã" flow was used.');
    } else {
        console.log('✅ Order should be treated as PRE-DELIVERY');
        console.log('   The update logic should have executed.');
    }
}

inspectRejectionFlow().catch(console.error);
