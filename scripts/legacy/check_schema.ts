
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

async function checkSchema() {
    const supabase = await createAdminClient();

    console.log("Checking columns for 'sales_documents'...");

    // Method 1: Use Postgres meta query via rpc (if available) or assume user has access.
    // Since we don't have direct SQL access easily, we can try to select * limit 0 and see what happens?
    // No, that doesn't list columns.

    // Method 2: Use information_schema (requires permissions, usually works on Supabase)
    // But supabase-js doesn't query information_schema easily unless allowed.

    // Method 3: Just try to update the column on a dummy row? No.

    // Let's try to infer from a select.
    const { data, error } = await supabase
        .from('sales_documents')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching sales_documents:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columns found on row:", Object.keys(data[0]));
        console.log("Has 'freight_mode'?", Object.keys(data[0]).includes('freight_mode'));
    } else {
        // If empty, insert a dummy and delete? Too risky.
        console.log("Table empty, cannot infer columns from data.");
        // Try querying information_schema via RPC if possible, or just trust the error message.
        // The error "Could not find the 'freight_mode' column" is pretty explicit.
        // It means the column is MISSING.
    }

}

checkSchema().catch(console.error);
