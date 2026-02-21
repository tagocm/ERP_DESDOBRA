
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUserCompany() {
    // 1. Valid Target Company (from existing data)
    const targetCompanyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

    // 2. The User (from debug logs)
    const userId = '1e18ff6c-3a97-4b19-ba60-a6cc0971a31b';

    console.log(`Fixing user ${userId} to be in company ${targetCompanyId}...`);

    // Check if target company exists
    const { data: company, error: cErr } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', targetCompanyId)
        .single();

    if (cErr || !company) {
        console.error("Target company NOT found!", cErr);
        return;
    }
    console.log(`Target Company found: ${company.name}`);

    // Update/Insert Membership
    const { error: memberError } = await supabase
        .from('company_members')
        .upsert({
            company_id: targetCompanyId,
            auth_user_id: userId,
            role: 'owner' // or admin
        }, { onConflict: 'company_id, auth_user_id' }); // adjust based on PK

    if (memberError) {
        console.error("Error updating membership:", memberError);
    } else {
        console.log("Membership updated.");
    }

    // Update User Metadata
    const { data: user, error: userError } = await supabase.auth.admin.updateUserById(
        userId,
        { user_metadata: { company_id: targetCompanyId } }
    );

    if (userError) {
        console.error("Error updating metadata:", userError);
    } else {
        console.log("User metadata updated.");
    }

    console.log("DONE. Please update NEXT_PUBLIC_DEV_COMPANY_ID to:", targetCompanyId);
}

fixUserCompany();
