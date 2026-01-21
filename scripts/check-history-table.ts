import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHistoryTable() {
    console.log('🔍 Checking sales_document_history table...\n');

    // Try to query the table
    const { data, error } = await supabase
        .from('sales_document_history')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error querying sales_document_history:');
        console.error('  Code:', error.code);
        console.error('  Message:', error.message);
        console.error('  Details:', error.details);
        console.error('  Hint:', error.hint);
        console.log('\n');

        // Check if it might be a different table name
        console.log('Checking for similar table names...');
        const { data: tables, error: tablesError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .like('table_name', '%history%');

        if (tables) {
            console.log('Found tables with "history" in name:');
            tables.forEach(t => console.log('  -', t.table_name));
        }
    } else {
        console.log('✅ Table exists and is queryable');
        console.log('Sample row count:', data?.length || 0);
    }

    // Try to describe the table structure
    console.log('\nChecking table schema...');
    const { data: columns, error: schemaError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_schema', 'public')
        .eq('table_name', 'sales_document_history')
        .order('ordinal_position');

    if (columns && columns.length > 0) {
        console.log('\nTable columns:');
        columns.forEach((col: any) => {
            console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
    } else if (schemaError) {
        console.log('Error fetching schema:', schemaError.message);
    } else {
        console.log('No columns found (table might not exist)');
    }
}

checkHistoryTable().catch(console.error);
