import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseFilter() {
    console.log('🔍 Diagnosing why Order #101 was skipped...\n');

    const { data: order } = await supabase
        .from('sales_documents')
        .select('id, document_number, doc_type, status_commercial')
        .eq('document_number', 101)
        .single();

    if (!order) {
        console.error('❌ Order not found');
        return;
    }

    console.log('Order #101:');
    console.log('  ID:', order.id);
    console.log('  doc_type:', order.doc_type);
    console.log('  status_commercial:', order.status_commercial);
    console.log('\n');

    // Replicate the filter logic
    const isFinishedStatus = ['approved', 'confirmed', 'cancelled', 'lost'].includes(order.status_commercial);
    console.log('Filter Logic:');
    console.log('  isFinishedStatus:', isFinishedStatus);

    if (isFinishedStatus) {
        console.log('  ❌ REJECTED: Status is in finished list');
        return;
    }

    const matchesCriteria =
        order.doc_type === 'proposal' ||
        order.status_commercial === 'draft' ||
        order.status_commercial === 'sent';

    console.log('  doc_type === "proposal"?', order.doc_type === 'proposal');
    console.log('  status_commercial === "draft"?', order.status_commercial === 'draft');
    console.log('  status_commercial === "sent"?', order.status_commercial === 'sent');
    console.log('  matchesCriteria:', matchesCriteria);

    if (matchesCriteria) {
        console.log('  ✅ SHOULD BE APPROVED');
    } else {
        console.log('  ❌ REJECTED: Does not match criteria');
    }
}

diagnoseFilter().catch(console.error);
