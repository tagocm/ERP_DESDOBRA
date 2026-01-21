import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnumType() {
    console.log('\n=== Checking logistics status enum type ===\n');

    // Check what type the column uses
    const { data: columns, error } = await supabase
        .from('sales_documents')
        .select('status_logistic')
        .limit(1);

    if (error) {
        console.error('Error querying:', error);
        return;
    }

    console.log('Sample data:', columns);

    // Try to get enum values by querying a record and seeing what values exist
    const { data: docs } = await supabase
        .from('sales_documents')
        .select('status_logistic')
        .limit(20);

    const uniqueStatuses = new Set(docs?.map(d => d.status_logistic));
    console.log('\nCurrent status values in use:');
    uniqueStatuses.forEach(s => console.log(`  - ${s}`));

    console.log('\n✅ Run this SQL in Supabase Dashboard to check enum name:');
    console.log(`
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%logistics%'
ORDER BY enum_name, e.enumsortorder;
    `);
}

checkEnumType();
