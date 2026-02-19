
import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from '../_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
    console.log("Checking company_settings...");

    // Check if table exists first or just query it
    const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1);

    if (error) {
        console.log("Error:", error);
    } else {
        console.log("Settings:", data);
    }
}

checkSettings();
