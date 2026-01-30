import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findMissing1402kg() {
    console.log('=== PROCURANDO OS 1.402 KG FALTANTES ===\n');
    console.log('Consumo calculado manualmente: 320 kg');
    console.log('Consumo retornado pela função: 1.722 kg');
    console.log('Diferença: 1.402 kg\n');

    const companyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

    // Buscar TODAS as work orders sem filtro de data (como o código faz)
    const { data: allWOs } = await supabase
        .from('work_orders')
        .select(`
            *,
            items!inner (id, type, name, sku)
        `)
        .eq('company_id', companyId)
        .in('status', ['planned', 'in_progress'])
        .eq('items.type', 'finished_good')
        .lte('scheduled_date', '2026-01-22')
        // SEM FILTRO DE DATA MÍNIMA!!!
        .order('scheduled_date', { ascending: true });

    console.log(`Total Work Orders (sem filtro de data mínima): ${allWOs?.length || 0}\n`);

    let totalConsumption = 0;

    for (const wo of allWOs || []) {
        const item = wo.items as any;
        const remaining = Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0));

        if (remaining <= 0) continue;

        if (!wo.bom_id) continue;

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

        // Verificar se tem Aveia COM AGRUPAMENTO
        const groupedComponents = new Map<string, number>();

        for (const line of bomLines || []) {
            const currentQty = groupedComponents.get(line.component_item_id) || 0;
            groupedComponents.set(line.component_item_id, currentQty + (line.qty || 0));
        }

        let hasAveia = false;
        let aveiaQtyPerBatch = 0;

        for (const [compId, qty] of groupedComponents.entries()) {
            const { data: comp } = await supabase
                .from('items')
                .select('name')
                .eq('id', compId)
                .single();

            if (comp?.name?.toLowerCase().includes('aveia')) {
                hasAveia = true;
                aveiaQtyPerBatch = qty;
                break;
            }
        }

        if (hasAveia) {
            const multiplier = remaining / (bomHeader?.yield_qty || 1);
            const consumption = aveiaQtyPerBatch * multiplier;

            console.log(`WO #${wo.id.substring(0, 8)}... | ${wo.scheduled_date} | ${item.name}`);
            console.log(`  Falta: ${remaining} × ${aveiaQtyPerBatch} kg Aveia = ${consumption.toFixed(3)} kg`);

            totalConsumption += consumption;
        }
    }

    console.log(`\n💥 TOTAL: ${totalConsumption.toFixed(3)} kg`);

    if (Math.abs(totalConsumption - 1722) < 1) {
        console.log('\n✅ ENCONTRADO! Este é o valor que a tela está usando.');
    } else {
        console.log(`\n❌ Ainda não bate. Diferença: ${Math.abs(totalConsumption - 1722).toFixed(3)} kg`);
    }
}

findMissing1402kg().catch(console.error);
