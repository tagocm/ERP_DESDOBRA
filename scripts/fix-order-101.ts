import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOrder101() {
    console.log('🔧 Fixing Order #101 state after incorrect rejection...\n');

    // Get current state
    const { data: order } = await supabase
        .from('sales_documents')
        .select('id, document_number, status_commercial, dispatch_blocked')
        .eq('document_number', 101)
        .single();

    if (!order) {
        console.error('❌ Order #101 not found');
        return;
    }

    console.log('Current state:');
    console.log('  Status Commercial:', order.status_commercial);
    console.log('  Dispatch Blocked:', order.dispatch_blocked);
    console.log('\n');

    // Apply the fix
    const { error } = await supabase
        .from('sales_documents')
        .update({
            status_commercial: 'draft',
            status_logistic: 'pendente',
            dispatch_blocked: true,
            dispatch_blocked_reason: 'Reprovação Financeira',
            dispatch_blocked_at: new Date().toISOString(),
            financial_status: 'em_revisao',
            scheduled_delivery_date: null,
            updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

    if (error) {
        console.error('❌ Error updating order:', error);
        return;
    }

    // Verify the fix
    const { data: updated } = await supabase
        .from('sales_documents')
        .select('status_commercial, status_logistic, dispatch_blocked, dispatch_blocked_reason, financial_status')
        .eq('id', order.id)
        .single();

    console.log('✅ Order #101 corrected successfully!\n');
    console.log('New state:');
    console.log('  Status Commercial:', updated?.status_commercial);
    console.log('  Status Logistic:', updated?.status_logistic);
    console.log('  Dispatch Blocked:', updated?.dispatch_blocked);
    console.log('  Dispatch Blocked Reason:', updated?.dispatch_blocked_reason);
    console.log('  Financial Status:', updated?.financial_status);
}

fixOrder101().catch(console.error);
