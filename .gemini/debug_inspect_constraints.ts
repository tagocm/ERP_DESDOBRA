
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectConstraints() {
    console.log('Inspecting constraints for inventory_movements...');

    // We can query pg_catalog or information_schema via RPC if strict, 
    // but standard client can't query system tables directly usually unless permissions allow.
    // However, we can try to use a simple RPC if one exists, or try to infer from error?
    // Actually, we can just try to insert/read and see...
    // Better: Create a SQL function to return constraints and call it.

    const { data, error } = await supabase.rpc('debug_get_constraints', { table_name: 'inventory_movements' });

    if (error) {
        console.error('RPC Error:', error);
        // Fallback: try to create the RPC
        await createDebugRpc();
        const { data: retryData, error: retryError } = await supabase.rpc('debug_get_constraints', { table_name: 'inventory_movements' });
        if (retryError) console.error('Retry RPC Error:', retryError);
        else console.log('Constraints:', retryData);
    } else {
        console.log('Constraints:', data);
    }
}

async function createDebugRpc() {
    console.log('Creating debug RPC...');
    const sql = `
    CREATE OR REPLACE FUNCTION debug_get_constraints(table_name text)
    RETURNS TABLE (constraint_name text, constraint_type text, foreign_table text, foreign_column text) AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            tc.constraint_name::text, 
            tc.constraint_type::text,
            ccu.table_name::text as foreign_table,
            ccu.column_name::text as foreign_column
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.table_name = debug_get_constraints.table_name;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // We can't run raw SQL from client easily. 
    // We should write this into a migration file and ask user to run it? 
    // OR we can just assume the migration failed to apply the constraint change.

    console.log("Cannot create RPC from client. Please inspect manually or assume failure.");
}

inspectConstraints();
