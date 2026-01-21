
import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient } from '@/lib/supabaseServer';

// Load .env.local manually
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach((line) => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const val = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
                process.env[key] = val;
            }
        });
    }
} catch (e) {
    console.error("Failed to load .env.local", e);
}

async function listRPCs() {
    const supabase = await createAdminClient();

    // Query detailed info if possible, usually blocked.
    // But we can try validation via rpc call?
    // Or check information_schema via standard query (PostgREST usually exposes RPCs if public).

    // There is no easy way to list RPCs via client unless we deduce.
    // BUT we can try to call 'exec_sql' and see if error is "function not found".

    console.log("Attempting to call 'exec_sql'...");
    const { error } = await supabase.rpc('exec_sql', { sql: 'select 1' });

    if (error) {
        console.log("exec_sql result:", error.message);
    } else {
        console.log("exec_sql exists and works!");
    }
}

listRPCs().catch(console.error);
