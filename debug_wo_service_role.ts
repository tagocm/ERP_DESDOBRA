import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use SERVICE ROLE key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugWithServiceRole() {
    console.log('=== USANDO SERVICE ROLE KEY (BYPASS RLS) ===\n');

    // 1. Listar todas as companies
    const { data: companies } = await supabase
        .from('companies')
        .select('*');

    console.log(`Companies encontradas: ${companies?.length || 0}\n`);
    companies?.forEach(c => {
        console.log(`  - ${c.name} (${c.id})`);
    });

    console.log('\n' + '='.repeat(80));

    // 2. Buscar TODAS as work orders sem RLS
    const { data: allWOs, error } = await supabase
        .from('work_orders')
        .select('*')
        .is('deleted_at', null);

    if (error) {
        console.error('Erro:', error);
        return;
    }

    console.log(`\nTotal Work Orders (todas companies): ${allWOs?.length || 0}\n`);

    // Agrupar por company
    const byCompany = new Map<string, any[]>();
    allWOs?.forEach(wo => {
        if (!byCompany.has(wo.company_id)) byCompany.set(wo.company_id, []);
        byCompany.get(wo.company_id)!.push(wo);
    });

    byCompany.forEach((wos, companyId) => {
        const company = companies?.find(c => c.id === companyId);
        console.log(`\nCompany: ${company?.name || companyId}`);
        console.log(`  Total WOs: ${wos.length}`);

        // Por status
        const byStatus = new Map<string, number>();
        wos.forEach(wo => {
            const count = byStatus.get(wo.status) || 0;
            byStatus.set(wo.status, count + 1);
        });

        byStatus.forEach((count, status) => {
            console.log(`    ${status}: ${count}`);
        });
    });

    // 3. Focar nas ordens ativas
    console.log('\n\n' + '='.repeat(80));
    console.log('ORDENS ATIVAS (planned/in_progress)');
    console.log('='.repeat(80) + '\n');

    const activeWOs = allWOs?.filter(wo =>
        wo.status === 'planned' || wo.status === 'in_progress'
    ) || [];

    console.log(`Total: ${activeWOs.length}\n`);

    for (const wo of activeWOs) {
        // Buscar item
        const { data: item } = await supabase
            .from('items')
            .select('*')
            .eq('id', wo.item_id)
            .single();

        console.log(`\n━━━ WO #${wo.id.substring(0, 8)}... ━━━`);
        console.log(`Produto: ${item?.name} (SKU: ${item?.sku})`);
        console.log(`Status: ${wo.status}`);
        console.log(`Data: ${wo.scheduled_date}`);
        console.log(`Planejado: ${wo.planned_qty}`);
        console.log(`Produzido: ${wo.produced_qty || 0}`);
        console.log(`Falta: ${Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0))}`);

        if (wo.bom_id) {
            // Buscar BOM
            const { data: bomHeader } = await supabase
                .from('bom_headers')
                .select('*')
                .eq('id', wo.bom_id)
                .single();

            console.log(`\nBOM ID: ${wo.bom_id}`);
            console.log(`  Yield: ${bomHeader?.yield_qty}`);
            console.log(`  Ativa: ${bomHeader?.is_active}`);

            // Buscar componentes
            const { data: bomLines } = await supabase
                .from('bom_lines')
                .select('*')
                .eq('bom_id', wo.bom_id);

            console.log(`  Componentes: ${bomLines?.length || 0}`);

            if (bomLines) {
                for (const line of bomLines) {
                    const { data: comp } = await supabase
                        .from('items')
                        .select('name, sku, uom')
                        .eq('id', line.component_item_id)
                        .single();

                    const isAveia = comp?.name?.toLowerCase().includes('aveia');
                    console.log(`    ${isAveia ? '🔵' : '  '} ${comp?.name} (${comp?.sku}): ${line.qty} ${comp?.uom}`);

                    if (isAveia) {
                        const remaining = Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0));
                        const multiplier = remaining / (bomHeader?.yield_qty || 1);
                        const consumption = line.qty * multiplier;
                        console.log(`       → Consumo previsto: ${consumption.toFixed(3)} ${comp?.uom}`);
                    }
                }
            }
        } else {
            console.log('⚠️  Sem BOM associada');
        }
    }

    // 4. Calcular total de Aveia
    console.log('\n\n' + '='.repeat(80));
    console.log('RESUMO: CONSUMO TOTAL DE AVEIA');
    console.log('='.repeat(80) + '\n');

    let totalAveia = 0;
    const details: any[] = [];

    for (const wo of activeWOs) {
        if (!wo.bom_id) continue;

        const { data: bomHeader } = await supabase
            .from('bom_headers')
            .select('yield_qty')
            .eq('id', wo.bom_id)
            .single();

        const { data: bomLines } = await supabase
            .from('bom_lines')
            .select('qty, component_item_id')
            .eq('bom_id', wo.bom_id);

        if (!bomLines) continue;

        for (const line of bomLines) {
            const { data: comp } = await supabase
                .from('items')
                .select('name, sku, uom')
                .eq('id', line.component_item_id)
                .single();

            if (comp?.name?.toLowerCase().includes('aveia')) {
                const { data: item } = await supabase
                    .from('items')
                    .select('name, sku')
                    .eq('id', wo.item_id)
                    .single();

                const remaining = Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0));
                const multiplier = remaining / (bomHeader?.yield_qty || 1);
                const consumption = line.qty * multiplier;

                totalAveia += consumption;
                details.push({
                    product: item?.name,
                    sku: item?.sku,
                    remaining,
                    yield: bomHeader?.yield_qty,
                    multiplier,
                    aveiaPerBatch: line.qty,
                    consumption
                });
            }
        }
    }

    if (details.length > 0) {
        console.table(details);
        console.log(`\n💥 TOTAL CONSUMO DE AVEIA: ${totalAveia.toFixed(3)} kg`);
    } else {
        console.log('Nenhum consumo de Aveia encontrado.');
    }
}

debugWithServiceRole().catch(console.error);
