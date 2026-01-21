import { createAdminClient } from '../lib/supabaseServer';

async function checkMartigranData() {
    const supabase = createAdminClient();

    console.log('\n=== Checking Martigran Company Records ===\n');

    // 1. Check companies table
    const { data: companies, error: compError } = await supabase
        .from('companies')
        .select('id, name, legal_name, trade_name, document_number')
        .or('legal_name.ilike.%martigran%,trade_name.ilike.%martigran%,name.ilike.%martigran%');

    console.log('Companies found:', companies?.length || 0);
    companies?.forEach((c, i) => {
        console.log(`\n${i + 1}. Company:`, {
            id: c.id,
            name: c.name,
            legal_name: c.legal_name,
            trade_name: c.trade_name,
            document: c.document_number
        });
    });

    // 2. Check company_settings for each company
    if (companies && companies.length > 0) {
        console.log('\n=== Company Settings (Fiscal Profiles) ===\n');

        for (const company of companies) {
            const { data: settings } = await supabase
                .from('company_settings')
                .select('*')
                .eq('company_id', company.id);

            console.log(`\nSettings for company ${company.id} (${company.legal_name}):`);
            console.log('Count:', settings?.length || 0);
            settings?.forEach((s, i) => {
                console.log(`  ${i + 1}.`, {
                    id: s.id,
                    cnpj: s.cnpj,
                    legal_name: s.legal_name,
                    ie: s.ie,
                    state_registration: s.state_registration,
                    tax_regime: s.tax_regime
                });
            });
        }
    }

    // 3. Check which company is being used in orders
    const { data: orders } = await supabase
        .from('sales_documents')
        .select('id, document_number, company_id')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('\n=== Recent Orders ===\n');
    orders?.forEach(o => {
        console.log(`Order #${o.document_number} uses company_id: ${o.company_id}`);
    });
}

checkMartigranData()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
