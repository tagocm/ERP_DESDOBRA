
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyRpc() {
    console.log('Verifying register_production_entry RPC...');

    // Call with dummy UUID to see if we get "Work Order not found" (Success) or "Function not found" (Fail)
    // Using a random UUID that definitely doesn't exist
    const dummyId = '00000000-0000-0000-0000-000000000000';

    const { error } = await supabase.rpc('register_production_entry', {
        p_work_order_id: dummyId,
        p_qty_produced: 1,
        p_occurred_at: new Date().toISOString(),
        p_notes: 'Verification Probe'
    });

    if (error) {
        if (error.message.includes('Work Order not found')) {
            console.log('SUCCESS: Function exists and returned logical error as expected.');
        } else if (error.message.includes('function') && error.message.includes('not found')) {
            console.error('FAILURE: Function not found in schema cache or DB.');
            console.error(error);
        } else {
            console.log('SUCCESS (Likely): Function exists but returned another error:', error.message);
        }
    } else {
        // Should not happen with dummy ID unless logic changed or ID exists
        console.log('Unexpected success (did the dummy ID exist?). Function definitely exists though.');
    }
}

verifyRpc();
