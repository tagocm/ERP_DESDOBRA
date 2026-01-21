import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabaseServer';

async function main() {
    const supabase = createAdminClient();

    console.log('--- Inspecting Work Orders ---');

    // Check Statuses
    const { data: statuses, error: statusError } = await supabase
        .from('work_orders')
        .select('status')
        .limit(100);

    if (statusError) {
        console.error('Status Error:', statusError);
    } else {
        const unique = Array.from(new Set(statuses.map(s => s.status)));
        console.log('Unique Statuses found:', unique);
    }

    // Check Schema (Columns) via a single row
    const { data: oneRow, error: rowError } = await supabase
        .from('work_orders')
        .select('*')
        .limit(1);

    if (rowError) {
        console.error('Row Error:', rowError);
    } else if (oneRow && oneRow.length > 0) {
        console.log('Single Row Keys:', Object.keys(oneRow[0]));
        console.log('Sample Row:', oneRow[0]);
    } else {
        console.log('No work orders found.');
    }

    // Check Inventory Movements ref_type
    console.log('\n--- Inspecting Inventory Movements ---');
    const { data: movements, error: movError } = await supabase
        .from('inventory_movements')
        .select('ref_type, ref_id')
        .not('ref_type', 'is', null)
        .limit(50);

    if (movError) {
        console.error('Movements Error:', movError);
    } else {
        const uniqueRefs = Array.from(new Set(movements.map(m => m.ref_type)));
        console.log('Unique Ref Types found:', uniqueRefs);
    }
}

main().catch(console.error);
