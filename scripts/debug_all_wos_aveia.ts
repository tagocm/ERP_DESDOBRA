import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugAllWorkOrders() {
    console.log('=== DEBUG: TODAS AS WORK ORDERS QUE CONSOMEM AVEIA ===\n');

    const companyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

    // Buscar TODAS as work orders no período
    const { data: allWOs } = await supabase
        .from('work_orders')
        .select(`
            *,
            items (name, sku, type)
        `)
        .eq('company_id', companyId)
        .in('status', ['planned', 'in_progress'])
        .is('deleted_at', null)
        .lte('scheduled_date', '2026-01-22')
        .order('scheduled_date', { ascending: true });

    console.log(`Total Work Orders (planned/in_progress): ${allWOs?.length || 0}\n`);

    let totalConsumption = 0;
    const woDetails: any[] = [];

    for (const wo of allWOs || []) {
        const item = wo.items as any;
        const remaining = Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0));

        console.log(`\nWO #${wo.id.substring(0, 8)}...`);
        console.log(`  Produto: ${item?.name} (${item?.sku})`);
        console.log(`  Status: ${wo.status}`);
        console.log(`  Data: ${wo.scheduled_date}`);
        console.log(`  Planejado: ${wo.planned_qty} | Produzido: ${wo.produced_qty || 0} | Falta: ${remaining}`);

        if (!wo.bom_id) {
            console.log(`  ⚠️  Sem BOM associada`);
            continue;
        }

        // Buscar BOM
        const { data: bomHeader } = await supabase
            .from('bom_headers')
            .select('yield_qty')
            .eq('id', wo.bom_id)
            .single();

        const { data: bomLines } = await supabase
            .from('bom_lines')
            .select('qty, component_item_id')
            .eq('bom_id', wo.bom_id);

        console.log(`  BOM ID: ${wo.bom_id}`);
        console.log(`  Yield: ${bomHeader?.yield_qty}`);
        console.log(`  Componentes: ${bomLines?.length}`);

        // Verificar se tem Aveia
        let hasAveia = false;
        let aveiaQtyPerBatch = 0;

        for (const line of bomLines || []) {
            const { data: comp } = await supabase
                .from('items')
                .select('name, sku')
                .eq('id', line.component_item_id)
                .single();

            if (comp?.name?.toLowerCase().includes('aveia')) {
                hasAveia = true;
                aveiaQtyPerBatch += line.qty || 0;
                console.log(`    🔵 Aveia: ${line.qty} kg (linha individual)`);
            }
        }

        if (hasAveia && remaining > 0) {
            const multiplier = remaining / (bomHeader?.yield_qty || 1);
            const consumption = aveiaQtyPerBatch * multiplier;

            console.log(`  📊 Cálculo:`);
            console.log(`     Falta produzir: ${remaining} kg`);
            console.log(`     Yield: ${bomHeader?.yield_qty}`);
            console.log(`     Multiplicador: ${multiplier.toFixed(4)}`);
            console.log(`     Aveia total por batch: ${aveiaQtyPerBatch} kg`);
            console.log(`     💥 CONSUMO: ${consumption.toFixed(3)} kg`);

            totalConsumption += consumption;

            woDetails.push({
                wo_id: wo.id.substring(0, 8),
                produto: item?.name,
                falta: remaining,
                yield: bomHeader?.yield_qty,
                mult: multiplier.toFixed(4),
                aveia_batch: aveiaQtyPerBatch,
                consumo: consumption.toFixed(3)
            });
        }
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('RESUMO DE CONSUMO DE AVEIA');
    console.log('='.repeat(80) + '\n');

    if (woDetails.length > 0) {
        console.table(woDetails);
        console.log(`\n💥 TOTAL CONSUMO DE AVEIA: ${totalConsumption.toFixed(3)} kg`);

        if (Math.abs(totalConsumption - 1722) < 1) {
            console.log('\n✅ Este total BATE com o valor mostrado na tela (1.722 kg)!');
            console.log('Isso significa que há mais work orders do que as 2 que conhecíamos.');
        } else if (Math.abs(totalConsumption - 320) < 1) {
            console.log('\n✅ Este total bate com o esperado (320 kg)!');
            console.log('O problema pode estar no frontend/cache.');
        } else {
            console.log(`\n⚠️  Total calculado: ${totalConsumption.toFixed(3)} kg`);
            console.log(`Esperado: 320 kg ou 1.722 kg`);
            console.log(`Diferença: ainda não explicada`);
        }
    } else {
        console.log('Nenhuma work order consumindo Aveia encontrada.');
    }
}

debugAllWorkOrders().catch(console.error);
