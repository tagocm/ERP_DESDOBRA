
import { createClient } from '@supabase/supabase-js';

export async function ensureE2EData() {
    console.log('--- Ensuring E2E Data Existence ---');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.warn('Skipping data setup: Missing SUPABASE_SERVICE_ROLE_KEY or URL');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get Company (Martigran)
    const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', 'martigran')
        .single();

    if (!company) {
        console.error('Company "martigran" not found. Cannot seed data.');
        return;
    }

    // 2. Ensure Organization "Emporio Do Arroz Integral"
    const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('company_id', company.id)
        .ilike('trade_name', 'Emporio Do Arroz Integral')
        .maybeSingle();

    let orgId = org?.id;

    if (!orgId) {
        console.log('Seeding "Emporio Do Arroz Integral"...');
        const { data: newOrg, error } = await supabase
            .from('organizations')
            .insert({
                company_id: company.id,
                trade_name: 'Emporio Do Arroz Integral',
                legal_name: 'Emporio Do Arroz Integral LTDA',
                document: '98765432000188',
                status: 'active'
            })
            .select('id')
            .single();

        if (error) {
            console.error('Failed to create organization:', error);
            return;
        }
        orgId = newOrg.id;
    } else {
        console.log('Organization "Emporio Do Arroz Integral" exists.');
    }

    // 3. Ensure "customer" Role
    const { data: role } = await supabase
        .from('organization_roles')
        .select('*')
        .eq('company_id', company.id)
        .eq('organization_id', orgId)
        .eq('role', 'customer')
        .maybeSingle();

    if (!role) {
        console.log('Assigning "customer" role...');
        await supabase
            .from('organization_roles')
            .insert({
                company_id: company.id,
                organization_id: orgId,
                role: 'customer'
            });
    }

    // 4. Ensure Product "Granola"
    const { data: prod } = await supabase
        .from('products')
        .select('id')
        .eq('company_id', company.id)
        .eq('code', 'GRA001')
        .maybeSingle();

    if (!prod) {
        console.log('Seeding "Granola Tradicional"...');
        const { data: newProd } = await supabase
            .from('products')
            .insert({
                company_id: company.id,
                name: 'Granola Tradicional',
                code: 'GRA001',
                unit: 'un',
                type: 'finished',
                status: 'active'
            })
            .select('id')
            .single();

        // Add Price
        if (newProd) {
            const { data: pt } = await supabase
                .from('price_tables')
                .select('id')
                .eq('company_id', company.id)
                .eq('active', true)
                .limit(1)
                .single();

            if (pt) {
                await supabase.from('price_table_items').insert({
                    price_table_id: pt.id,
                    product_id: newProd.id,
                    price: 10.00
                });
            }
        }
    } else {
        console.log('Product "Granola Tradicional" exists.');
    }
}
