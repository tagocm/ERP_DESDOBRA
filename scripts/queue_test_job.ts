
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing environment variables. Check .env.local");
    process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function createTestJob() {
    console.log("👉 Creating Test Job (NFE_EMIT)...");

    const { data, error } = await supabase
        .from('jobs_queue')
        .insert({
            job_type: 'NFE_EMIT',
            payload: { fake_nfe_id: 123 },
            status: 'pending' // Default, but being explicit
        })
        .select('id')
        .single();

    if (error) {
        console.error("❌ Failed to create job:", error.message);
    } else {
        console.log(`✅ Job Created! ID: ${data.id}`);
    }
}

createTestJob();
