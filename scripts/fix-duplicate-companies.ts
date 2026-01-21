
import { createAdminClient } from '@/lib/supabaseServer';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const supabase = createAdminClient();

    const BAD_ID = 'd9938f71-2d61-4e65-8620-6fec9e0f3b55';
    const GOOD_ID = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

    console.log(`Checking dependencies for BAD_ID: ${BAD_ID}`);

    const tablesToCheck = [
        'sales_documents',
        'items', // products
        'organizations', // clients/carriers
        'payment_terms',
        'sales_document_items', // usually cascades or linked via order, but good to check
        'users',
        'people',
        'addresses',
        // Add others if needed: uoms, tax_groups, etc.
    ];

    for (const table of tablesToCheck) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('company_id', BAD_ID);

        if (error) console.error(`Error checking ${table}:`, error.message);
        else console.log(`Table '${table}': ${count} records found.`);

        if (count && count > 0) {
            console.log(`Migrating ${count} records in ${table} to GOOD_ID...`);
            const { error: moveError } = await supabase
                .from(table)
                .update({ company_id: GOOD_ID })
                .eq('company_id', BAD_ID);

            if (moveError) console.error(`Failed to migrate ${table}:`, moveError.message);
            else console.log(`Successfully migrated ${table}.`);
        }
    }

    // Finally, check settings and members (usually 1:1 or 1:N)
    // Settings we delete. Members we join/migrate?

    console.log('Deleting Ghost Company Settings...');
    const { error: delSettings } = await supabase.from('company_settings').delete().eq('company_id', BAD_ID);
    if (delSettings) console.error('Error deleting settings:', delSettings);

    console.log('Deleting Ghost Company...');
    const { error: delCompany } = await supabase.from('companies').delete().eq('id', BAD_ID);

    if (delCompany) {
        console.error('Error deleting company:', delCompany);
        console.log('Use cascade or check for other foreign keys.');
    } else {
        console.log('Ghost Company Deleted Successfully.');
    }
}

main();
