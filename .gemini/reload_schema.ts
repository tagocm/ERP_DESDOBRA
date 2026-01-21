
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function reloadSchema() {
    console.log("Notifying PostgREST to reload schema...");
    const { error } = await supabase.rpc('exec_sql', {
        sql_string: "NOTIFY pgrst, 'reload schema';"
    });

    if (error) {
        console.log("Error notifying via exec_sql:", error);
        // Fallback: simple query that might trigger something? No, explicit notify is best.
        // If exec_sql missing, we can try to run a dummy migration or just creating a dummy function and dropping it.
        const { error: funcError } = await supabase.rpc('reload_schema_cache_helper'); // hypothetical
        if (funcError) console.log("Helper not found/failed.");
    } else {
        console.log("Schema reload signal sent.");
    }
}

reloadSchema();
