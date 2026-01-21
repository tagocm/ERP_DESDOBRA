
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectPolicies() {
    console.log("--- Inspecting RLS Policies ---");

    // We can't query pg_policies directly via supabase-js client (unless exposed via stored proc or view).
    // But we can check if RLS is enabled via `pg_class`?
    // No, easiest is to use a simple query on 'deliveries' and see if we can read it?
    // But Service Role bypasses RLS.
    // So we can't test RLS enforcement with Service Role.

    // We can use rpc to execute SQL if we have one?
    // We do NOT have a generic exec_sql RPC usually.

    // BUT we can check if 'deliveries' table is readable by ANON?
    // Create anon client
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseAnon = createClient(supabaseUrl, anonKey);

    const { data: anonData, error: anonError } = await supabaseAnon.from('deliveries').select('id').limit(1);
    console.log("Anon Access Result:", anonError ? `Error: ${anonError.message}` : `Success (${anonData?.length} rows)`);

    // If Anon fails, it means RLS is likely checking auth.
    // We are stuck without a user token to test 'authenticated' role.

    // However, if the user (in browser) fails to see data, it means policies are likely missing or strict.
    // Default RLS is "Deny All".
    // If no policy exists for 'deliveries', NO ONE (except Service Role) can read.

    // Attempt to list policies via RPC if available?
    // Try to find policies via migration files (grep) failed.
    // This strongly suggests policies MIGHT BE MISSING.

    console.log("If Anon Access is empty/error and no policies exist in code, then Authenticated access is likely blocked too.");
}

inspectPolicies();
