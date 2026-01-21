
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const startDate = '2026-01-07';
    const endDate = '2026-01-07';

    // 1. Check ALL work orders for that date regardless of status
    console.log('--- ALL ORDERS FOR 2026-01-07 ---');
    const { data: allOrders, error: allError } = await supabase
        .from('work_orders')
        .select('id, scheduled_date, status, planned_qty, item_id')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);

    if (allError) console.error(allError);
    else console.table(allOrders);

    // 2. Check Item Names to confirm Granola Tradicional 1kg ID
    if (allOrders && allOrders.length > 0) {
        const ids = [...new Set(allOrders.map(o => o.item_id))];
        const { data: items } = await supabase.from('items').select('id, name').in('id', ids);
        console.log('--- ITEMS ---');
        console.table(items);
    }
}

check();
