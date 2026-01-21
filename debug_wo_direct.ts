import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugWorkOrdersDirect() {
    console.log('=== BUSCA DIRETA DE WORK ORDERS ===\n');

    // Buscar TODAS as work orders sem filtros
    const { data: allWOs, error } = await supabase
        .from('work_orders')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao buscar WOs:', error);
        return;
    }

    console.log(`Total de Work Orders no sistema: ${allWOs?.length || 0}\n`);

    // Agrupar por status
    const byStatus = new Map<string, any[]>();
    allWOs?.forEach(wo => {
        const status = wo.status || 'unknown';
        if (!byStatus.has(status)) byStatus.set(status, []);
        byStatus.get(status)!.push(wo);
    });

    console.log('Ordens por Status:');
    byStatus.forEach((wos, status) => {
        console.log(`  ${status}: ${wos.length}`);
    });

    // Focar nas ordens planned e in_progress
    const activeWOs = allWOs?.filter(wo =>
        wo.status === 'planned' || wo.status === 'in_progress'
    ) || [];

    console.log(`\n\n=== ORDENS ATIVAS (planned/in_progress): ${activeWOs.length} ===\n`);

    for (const wo of activeWOs) {
        console.log(`\nWO ID: ${wo.id}`);
        console.log(`  Status: ${wo.status}`);
        console.log(`  Item ID: ${wo.item_id}`);
        console.log(`  BOM ID: ${wo.bom_id}`);
        console.log(`  Data agendada: ${wo.scheduled_date}`);
        console.log(`  Quantidade planejada: ${wo.planned_qty}`);
        console.log(`  Quantidade produzida: ${wo.produced_qty || 0}`);
        console.log(`  Falta produzir: ${Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0))}`);

        // Buscar info do item
        const { data: item } = await supabase
            .from('items')
            .select('name, sku, type')
            .eq('id', wo.item_id)
            .single();

        if (item) {
            console.log(`  Produto: ${item.name} (SKU: ${item.sku}) - ${item.type}`);
        }

        // Buscar BOM se existir
        if (wo.bom_id) {
            const { data: bomHeader } = await supabase
                .from('bom_headers')
                .select('yield_qty, is_active')
                .eq('id', wo.bom_id)
                .single();

            console.log(`  BOM Yield: ${bomHeader?.yield_qty || 'N/A'}`);
            console.log(`  BOM Ativa: ${bomHeader?.is_active}`);

            // Buscar linhas do BOM
            const { data: bomLines } = await supabase
                .from('bom_lines')
                .select(`
                    qty,
                    component_item_id
                `)
                .eq('bom_id', wo.bom_id);

            console.log(`  Componentes: ${bomLines?.length || 0}`);

            if (bomLines && bomLines.length > 0) {
                for (const line of bomLines) {
                    const { data: component } = await supabase
                        .from('items')
                        .select('name, sku, uom')
                        .eq('id', line.component_item_id)
                        .single();

                    const isAveia = component?.name?.toLowerCase().includes('aveia');
                    const marker = isAveia ? '🔵 AVEIA' : '';

                    console.log(`    - ${component?.name} (${component?.sku}): ${line.qty} ${component?.uom} ${marker}`);

                    if (isAveia) {
                        const remaining = Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0));
                        const yieldQty = bomHeader?.yield_qty || 1;
                        const multiplier = remaining / yieldQty;
                        const aveiaNeeded = line.qty * multiplier;
                        console.log(`      💥 CONSUMO PREVISTO DE AVEIA: ${aveiaNeeded.toFixed(3)} ${component?.uom}`);
                    }
                }
            }
        }
    }

    // Calcular total de consumo de Aveia
    console.log('\n\n' + '='.repeat(80));
    console.log('CÁLCULO TOTAL DE CONSUMO DE AVEIA');
    console.log('='.repeat(80) + '\n');

    let totalAveiaConsumption = 0;

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
            const { data: component } = await supabase
                .from('items')
                .select('name, uom')
                .eq('id', line.component_item_id)
                .single();

            if (component?.name?.toLowerCase().includes('aveia')) {
                const remaining = Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0));
                const yieldQty = bomHeader?.yield_qty || 1;
                const multiplier = remaining / yieldQty;
                const aveiaNeeded = line.qty * multiplier;

                totalAveiaConsumption += aveiaNeeded;

                console.log(`WO ${wo.id.substring(0, 8)}... | Falta: ${remaining} | Mult: ${multiplier.toFixed(4)} | Aveia: ${aveiaNeeded.toFixed(3)}`);
            }
        }
    }

    console.log(`\n📊 TOTAL CONSUMO DE AVEIA: ${totalAveiaConsumption.toFixed(3)} kg`);
}

debugWorkOrdersDirect().catch(console.error);
