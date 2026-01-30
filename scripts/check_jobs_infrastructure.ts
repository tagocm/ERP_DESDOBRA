
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function checkJobsQueue() {
  console.log('Checking jobs_queue table existence...');
  const { error } = await supabase.from('jobs_queue').select('id').limit(1);
  
  if (error) {
    if (error.code === '42P01') {
      console.error('❌ Table jobs_queue DOES NOT exist.');
    } else {
      console.error('❌ Error querying jobs_queue:', error.message);
    }
  } else {
    console.log('✅ Table jobs_queue exists.');
  }

  console.log('Checking fetch_next_job function...');
  const { error: funcError } = await supabase.rpc('fetch_next_job', { p_job_type: 'test_job' });
  if (funcError) {
      // It returns empty set if no job, which is fine. Error means function missing or params wrong.
      // Actually if function exists but returns empty, it's success (data is empty array).
      // If error says "function not found", then it failed.
      console.log('RPC Call Result:', funcError.message);
  } else {
      console.log('✅ Function fetch_next_job exists and is callable.');
  }
}

checkJobsQueue();
