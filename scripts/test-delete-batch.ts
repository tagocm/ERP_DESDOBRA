import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDeleteBatch() {
    console.log('🧪 Testing batch delete API directly...\n');

    // Get some test orders
    const { data: orders } = await supabase
        .from('sales_documents')
        .select('id, document_number, status_logistic')
        .eq('status_commercial', 'draft')
        .limit(2);

    if (!orders || orders.length === 0) {
        console.log('❌ No draft orders found to test with');
        return;
    }

    console.log('Found test orders:');
    orders.forEach(o => console.log(`  - #${o.document_number} (${o.status_logistic})`));
    console.log('\n');

    const testIds = orders.map(o => o.id);

    console.log('🔄 Calling delete-batch API...\n');

    try {
        const response = await fetch('http://localhost:3000/api/sales/delete-batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids: testIds }),
        });

        console.log('Response Status:', response.status);
        console.log('Response OK:', response.ok);

        const result = await response.json();
        console.log('Response Body:', JSON.stringify(result, null, 2));

        if (!response.ok) {
            console.log('\n❌ API returned error');
        } else {
            console.log('\n✅ API call successful');
        }
    } catch (error: any) {
        console.error('\n❌ Fetch error:', error.message);
    }
}

testDeleteBatch().catch(console.error);
