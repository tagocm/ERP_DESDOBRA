
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findEvent() {
    console.log('🔍 Searching for Financial Event for Order #91 (Amount: 576.00)...');

    // Search by amount and description hint
    const { data: events, error } = await supabase
        .from('financial_events')
        .select('*')
        .eq('amount_total', 576.00) // Assuming column name, verify if it's amount or value
        .limit(5);

    if (error && error.code === '42703') {
        // Maybe 'amount' or 'value'?
        console.log('Retrying with "amount"...');
        const { data: events2 } = await supabase
            .from('financial_events')
            .select('*')
            .eq('amount', 576.00)
            .limit(5);
        console.log('Events found:', events2);
        return;
    }

    console.log('Events found:', events);
}

findEvent();
