import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDeleteColumns() {
    console.log('🔍 Checking sales_documents table columns for delete fields...\n');

    const { data: columns, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_schema', 'public')
        .eq('table_name', 'sales_documents')
        .in('column_name', ['deleted_at', 'deleted_by', 'delete_reason'])
        .order('column_name');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    if (columns && columns.length > 0) {
        console.log('Found delete-related columns:');
        columns.forEach((col: any) => {
            console.log(`  ✅ ${col.column_name}: ${col.data_type}`);
        });
    } else {
        console.log('❌ No delete-related columns found');
        console.log('The table might not have soft-delete support');
    }

    // Check all columns to see what exists
    const { data: allColumns } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'sales_documents')
        .order('column_name');

    if (allColumns) {
        console.log('\n📋 All columns in sales_documents:');
        allColumns.forEach((col: any, idx: number) => {
            if (idx % 5 === 0) console.log(''); // New line every 5 columns
            process.stdout.write(`  ${col.column_name.padEnd(25)}`);
        });
        console.log('\n');
    }
}

checkDeleteColumns().catch(console.error);
