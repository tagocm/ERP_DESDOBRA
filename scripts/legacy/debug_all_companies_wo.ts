import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllCompaniesWorkOrders() {
    console.log('=== CHECKING ALL COMPANIES ===\n');

    const { data: companies } = await supabase
        .from('companies')
        .select('id, name');

    console.log(`Found ${companies?.length || 0} companies:\n`);

    for (const company of companies || []) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`COMPANY: ${company.name}`);
        console.log(`ID: ${company.id}`);
        console.log('='.repeat(80));

        // Get work orders
        const { data: workOrders } = await supabase
            .from('work_orders')
            .select(`
                id,
                status,
                scheduled_date,
                planned_qty,
                produced_qty,
                bom_id,
                item_id,
                items (name, sku, type)
            `)
            .eq('company_id', company.id)
            .in('status', ['planned', 'in_progress'])
            .order('scheduled_date', { ascending: true });

        console.log(`\nWork Orders (planned/in_progress): ${workOrders?.length || 0}\n`);

        if (workOrders && workOrders.length > 0) {
            for (const wo of workOrders) {
                const item = wo.items as any;
                console.log(`  WO #${wo.id.substring(0, 8)}...`);
                console.log(`    Product: ${item?.name} (${item?.sku})`);
                console.log(`    Status: ${wo.status}`);
                console.log(`    Date: ${wo.scheduled_date}`);
                console.log(`    Qty: ${wo.planned_qty} (Produced: ${wo.produced_qty || 0})`);
                console.log(`    BOM ID: ${wo.bom_id || 'NULL'}`);

                // If has BOM, get components
                if (wo.bom_id) {
                    const { data: bomLines } = await supabase
                        .from('bom_lines')
                        .select(`
                            qty,
                            component_item_id,
                            items (name, sku, uom)
                        `)
                        .eq('bom_id', wo.bom_id);

                    console.log(`    Components:`);
                    bomLines?.forEach((line: any) => {
                        const comp = line.items;
                        console.log(`      - ${comp.name} (${comp.sku}): ${line.qty} ${comp.uom}`);
                    });
                }
                console.log('');
            }

            // Look specifically for Aveia consumption
            console.log('\n  🔍 Searching for AVEIA consumption in this company...\n');

            for (const wo of workOrders) {
                if (!wo.bom_id) continue;

                const { data: bomLines } = await supabase
                    .from('bom_lines')
                    .select(`
                        qty,
                        items!inner (name, sku)
                    `)
                    .eq('bom_id', wo.bom_id)
                    .ilike('items.name', '%aveia%');

                if (bomLines && bomLines.length > 0) {
                    console.log(`    ✅ Found Aveia in WO #${wo.id}`);
                    console.log(`       Product: ${(wo.items as any)?.name}`);
                    console.log(`       Qty needed: ${bomLines[0].qty}`);
                    console.log('');
                }
            }
        }
    }

    // Direct check: any BOM lines with Aveia
    console.log('\n' + '='.repeat(80));
    console.log('GLOBAL CHECK: All BOM lines containing AVEIA');
    console.log('='.repeat(80) + '\n');

    const { data: allAveiaLines } = await supabase
        .from('bom_lines')
        .select(`
            id,
            qty,
            bom_id,
            items!bom_lines_component_item_id_fkey (name, sku),
            bom_headers!inner (
                id,
                is_active,
                company_id,
                items!bom_headers_item_id_fkey (name, sku, type)
            )
        `)
        .ilike('items.name', '%aveia%');

    console.log(`Found ${allAveiaLines?.length || 0} BOM lines with Aveia\n`);

    allAveiaLines?.forEach((line: any) => {
        const bom = line.bom_headers;
        const component = line.items;
        const product = bom.items;

        console.log(`BOM ID: ${bom.id} (Active: ${bom.is_active})`);
        console.log(`  Product: ${product.name} (${product.sku}) - ${product.type}`);
        console.log(`  Component: ${component.name} (${component.sku})`);
        console.log(`  Qty: ${line.qty}`);
        console.log(`  Company ID: ${bom.company_id}`);
        console.log('');
    });
}

checkAllCompaniesWorkOrders().catch(console.error);
