
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Use service role key to bypass RLS and see everything
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGaps() {
    const { data: allOrders, error } = await supabase
        .from('sales_documents')
        .select('id, document_number, status_commercial, deleted_at, created_at')
        .order('document_number', { ascending: true });

    if (error) {
        console.error('Error fetching orders:', error);
        return;
    }

    if (!allOrders || allOrders.length === 0) {
        console.log('No orders found.');
        return;
    }

    console.log(`Found ${allOrders.length} orders total.`);

    // Find duplicates
    const seen = new Set();
    const duplicates = [];
    allOrders.forEach(o => {
        if (o.document_number) {
            if (seen.has(o.document_number)) duplicates.push(o.document_number);
            seen.add(o.document_number);
        }
    });
    if (duplicates.length > 0) console.log('DUPLICATE NUMBERS FOUND:', duplicates);

    const validOrders = allOrders.filter(o => o.document_number !== null);
    const maxNum = Math.max(...validOrders.map(o => Number(o.document_number)));
    const minNum = Math.min(...validOrders.map(o => Number(o.document_number)));

    console.log(`Range: #${minNum} to #${maxNum}`);

    const existingNums = new Set(validOrders.map(o => Number(o.document_number)));
    const gaps = [];

    for (let i = minNum; i <= maxNum; i++) {
        if (!existingNums.has(i)) {
            gaps.push(i);
        }
    }

    console.log('GAPS DETECTED:', gaps);

    // Check hidden/deleted orders that MIGHT exist
    const hiddenOrders = validOrders.filter(o => o.deleted_at !== null || o.status_commercial === 'draft');
    console.log('HIDDEN ORDERS (Deleted or Draft) that consumed numbers:');
    hiddenOrders.forEach(o => {
        console.log(`- #${o.document_number}: Status=${o.status_commercial}, Deleted=${o.deleted_at}, Created=${o.created_at}`);
    });
}

checkGaps();
