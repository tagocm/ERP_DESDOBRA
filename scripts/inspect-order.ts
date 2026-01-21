
import { createAdminClient } from '@/lib/supabaseServer';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const supabase = createAdminClient();
    const documentId = process.env.DOCUMENT_ID || '60dab34a-ab92-46e8-8e64-5752ae5ddde9'; // Order #57

    console.log(`Inspecting Order: ${documentId}`);

    const { data: order, error } = await supabase
        .from('sales_documents')
        .select('*')
        .eq('id', documentId)
        .single();

    if (error) {
        console.error('Error fetching order:', error);
        return;
    }

    console.log(JSON.stringify(order, null, 2));

    if (order.company_id) {
        console.log(`\nCompany ID: ${order.company_id}`);

        console.log(`\n--- Replicating Server Action Query ---`);
        console.log(`Querying company: ${order.company_id} with relations...`);

        const { data: company, error: coErr } = await supabase
            .from('companies')
            .select(`*, addresses(*), fiscal_profile:company_fiscal_settings(*)`)
            .eq('id', order.company_id)
            .single();

        if (coErr) {
            console.error('Error fetching company (Full Query):', coErr);
        } else {
            console.log('Company found (Full Query):', company ? 'YES' : 'NULL');
            if (company) {
                console.log('Addresses:', company.addresses?.length);
                console.log('Fiscal Profile:', company.fiscal_profile ? 'YES' : 'NO');
            }
        }
    }
}

main();
