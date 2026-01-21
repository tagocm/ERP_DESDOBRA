
import { createAdminClient } from '../lib/supabaseServer';

async function checkSettings() {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('company_settings').select('*').limit(1);
    if (error) {
        console.error(error);
        return;
    }
    console.log(JSON.stringify(data, null, 2));
}

checkSettings();
