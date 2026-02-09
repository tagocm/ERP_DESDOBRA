
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMemberPolicies() {
    console.log("Checking pg_policies for company_members...");

    // We can query pg_policies via RPC or raw query if allowed, 
    // but easier to just check if I can select from it as a random user?
    // No, I can't easily simulate a user here without their token.
    // I will checking the table via service role to see correct structure.

    const { data, error } = await supabase
        .from('company_members')
        .select('*')
        .limit(5);

    if (error) {
        console.error("Error fetching members as service role:", error);
    } else {
        console.log("Service role can see members:", data.length);
        if (data.length > 0) console.log("Sample member:", data[0]);
    }
}

checkMemberPolicies();
