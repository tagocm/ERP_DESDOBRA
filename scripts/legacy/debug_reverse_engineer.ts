import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkYieldAndReverse() {
    console.log('=== REVERSE ENGINEERING O VALOR 1.722 ===\n');

    // Se consumo = 1.722 e temos 160 kg de saldo (100 + 60)
    // Qual seria o multiplicador?
    const displayedConsumption = 1.722;
    const totalRemaining = 160; // 100 + 60
    const aveiaPerBatch = 1; // Segundo o BOM

    console.log(`Consumo mostrado: ${displayedConsumption} kg`);
    console.log(`Total faltando produzir: ${totalRemaining} kg`);
    console.log(`Aveia por batch (BOM): ${aveiaPerBatch} kg`);

    const impliedMultiplier = displayedConsumption / totalRemaining;
    console.log(`\nMultiplicador implícito: ${impliedMultiplier.toFixed(6)}`);

    // Se multiplicador = remaining / yield
    // Então yield = remaining / multiplicador
    const impliedYield = totalRemaining / impliedMultiplier;
    console.log(`Yield implícito: ${impliedYield.toFixed(6)}\n`);

    // Testes de hipóteses
    console.log('='.repeat(80));
    console.log('HIPÓTESES:\n');

    // Hipótese 1: Yield incorreto no banco
    console.log('1. Se yield fosse 14.83:');
    console.log(`   Mult = 160 / 14.83 = ${(160 / 14.83).toFixed(4)}`);
    console.log(`   Consumo = ${(160 / 14.83 * 1).toFixed(3)} kg (sem duplicação)`);
    console.log(`   Consumo = ${(160 / 14.83 * 2).toFixed(3)} kg (com duplicação)\n`);

    // Hipótese 2: Qty de Aveia errado
    const qtyNeeded = displayedConsumption / totalRemaining;
    console.log(`2. Se quantidade de Aveia por batch fosse ${qtyNeeded.toFixed(4)} kg:`);
    console.log(`   Com yield=1, consumo = 160 * ${qtyNeeded.toFixed(4)} = ${displayedConsumption} kg\n`);

    // Hipótese 3: Há mais work orders escondidas
    const additionalWOs = (displayedConsumption - 320) / 2; // assuming duplicação
    console.log(`3. Se houvesse mais WOs escondidas:`);
    console.log(`   Faltaria ${additionalWOs.toFixed(0)} kg adicionais para alcançar 1.722 kg (com dup.)\n`);

    // Vamos verificar o BOM atual
    console.log('='.repeat(80));
    console.log('DADOS REAIS DO BANCO:\n');

    const { data: granola } = await supabase
        .from('items')
        .select('id, name')
        .ilike('name', '%granola%tradicional%')
        .single();

    const { data: bom } = await supabase
        .from('bom_headers')
        .select('*')
        .eq('item_id', granola.id)
        .eq('is_active', true)
        .single();

    console.log(`BOM ID: ${bom.id}`);
    console.log(`Yield (rendimento): ${bom.yield_qty}`);
    console.log(`Version: ${bom.version}`);
    console.log(`Is Active: ${bom.is_active}\n`);

    const { data: lines } = await supabase
        .from('bom_lines')
        .select(`
            *,
            items (name, sku, uom)
        `)
        .eq('bom_id', bom.id);

    console.log(`Linhas do BOM: ${lines?.length || 0}\n`);

    lines?.forEach((line: any) => {
        const item = line.items;
        const isAveia = item.name?.toLowerCase().includes('aveia');
        console.log(`${isAveia ? '🔵' : '  '} ${item.name} (${item.sku})`);
        console.log(`   Qty: ${line.qty} ${item.uom}`);
        console.log(`   ID: ${line.id}`);
        console.log('');
    });

    // Simular cálculo exato da tela
    console.log('='.repeat(80));
    console.log('SIMULANDO CÁLCULO DA TELA DE NECESSIDADES:\n');

    const { data: wos } = await supabase
        .from('work_orders')
        .select('*')
        .eq('item_id', granola.id)
        .in('status', ['planned', 'in_progress'])
        .is('deleted_at', null);

    const forecastMap = new Map<string, number>();

    for (const wo of wos || []) {
        const planned = wo.planned_qty || 0;
        const produced = wo.produced_qty || 0;
        const remaining = Math.max(0, planned - produced);

        console.log(`WO ${wo.id.substring(0, 8)}... | Status: ${wo.status} | Planejado: ${planned} | Produzido: ${produced} | Falta: ${remaining}`);

        if (remaining <= 0) continue;

        const yieldQty = bom.yield_qty || 1;
        const multiplier = remaining / yieldQty;

        console.log(`  Yield: ${yieldQty}, Multiplier: ${multiplier.toFixed(4)}`);

        if (lines) {
            for (const line of lines) {
                const componentId = line.component_item_id;
                const totalNeeded = (line.qty || 0) * multiplier;
                const current = forecastMap.get(componentId) || 0;
                forecastMap.set(componentId, current + totalNeeded);

                const item = line.items as any;
                if (item.name?.toLowerCase().includes('aveia')) {
                    console.log(`    → Aveia: ${line.qty} * ${multiplier.toFixed(4)} = ${totalNeeded.toFixed(3)} kg`);
                }
            }
        }
    }

    console.log('\n📊 TOTAIS POR COMPONENTE:\n');
    for (const [compId, qty] of forecastMap.entries()) {
        const { data: item } = await supabase
            .from('items')
            .select('name, sku, uom')
            .eq('id', compId)
            .single();

        const isAveia = item?.name?.toLowerCase().includes('aveia');
        console.log(`${isAveia ? '🔵' : '  '} ${item?.name}: ${qty.toFixed(3)} ${item?.uom}`);
    }
}

checkYieldAndReverse().catch(console.error);
