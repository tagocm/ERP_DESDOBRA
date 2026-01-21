import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDeleteOperation() {
    console.log('🧪 Testing delete operation with actual data...\n');

    // Get a test order
    const { data: order } = await supabase
        .from('sales_documents')
        .select('id, document_number')
        .eq('document_number', 101)
        .single();

    if (!order) {
        console.log('No test order found');
        return;
    }

    console.log('Testing with Order #101, ID:', order.id);
    console.log('\n');

    // Try the exact update from the delete-batch API
    console.log('🔄 Attempting soft delete...\n');

    const { error } = await supabase
        .from('sales_documents')
        .update({
            deleted_at: new Date().toISOString(),
            deleted_by: 'test-user-id',
            delete_reason: 'Test exclusão',
            status_commercial: 'cancelled'
        })
        .eq('id', order.id);

    if (error) {
        console.error('❌ Delete operation failed:');
        console.error('  Code:', error.code);
        console.error('  Message:', error.message);
        console.error('  Details:', error.details);
        console.error('  Hint:', error.hint);

        // Try without the problematic fields
        console.log('\n🔄 Trying without deleted_by and delete_reason...\n');

        const { error: error2 } = await supabase
            .from('sales_documents')
            .update({
                deleted_at: new Date().toISOString(),
                status_commercial: 'cancelled'
            })
            .eq('id', order.id);

        if (error2) {
            console.error('❌ Still failed:', error2.message);
        } else {
            console.log('✅ Worked without deleted_by and delete_reason fields!');
            console.log('Those columns likely don\'t exist in the table');
        }
    } else {
        console.log('✅ Delete operation succeeded!');
    }
}

testDeleteOperation().catch(console.error);
