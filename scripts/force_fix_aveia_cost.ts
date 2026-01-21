import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function forceFixCosts() {
    console.log('=== FORÇANDO CORREÇÃO DE CUSTOS ===\n');

    const companyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

    // Buscar Aveia
    const { data: aveia } = await supabase
        .from('items')
        .select('id, name, sku, avg_cost')
        .eq('company_id', companyId)
        .ilike('name', '%aveia%')
        .single();

    if (!aveia) {
        console.log('❌ Aveia não encontrada!');
        return;
    }

    console.log(`Item: ${aveia.name} (${aveia.sku})`);
    console.log(`Custo atual: R$ ${aveia.avg_cost.toFixed(2)}/kg\n`);

    // Calcular custo correto
    const correctCost = 105.00 / 25; // R$ 105/saco ÷ 25kg/saco

    console.log(`Aplicando correção:`);
    console.log(`  R$ 105,00 / 25kg = R$ ${correctCost.toFixed(2)}/kg\n`);

    // Atualizar custo
    const { error: updateError } = await supabase.rpc('update_item_cost', {
        p_item_id: aveia.id,
        p_new_cost: correctCost
    });

    if (updateError) {
        console.error('Erro ao atualizar:', updateError);
        return;
    }

    console.log('✅ Custo da Aveia atualizado\n');

    // Recalcular produtos dependentes
    console.log('Recalculando produtos dependentes...\n');

    const { error: recalcError } = await supabase.rpc('recalculate_dependent_costs', {
        p_component_id: aveia.id
    });

    if (recalcError) {
        console.error('Erro ao recalcular:', recalcError);
        return;
    }

    console.log('✅ Produtos recalculados\n');

    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verificar resultado
    console.log('━'.repeat(60));
    console.log('CUSTOS FINAIS:');
    console.log('━'.repeat(60) + '\n');

    const { data: finalItems } = await supabase
        .from('items')
        .select('name, sku, uom, avg_cost')
        .eq('company_id', companyId)
        .in('name', ['Aveia', 'Granola Tradicional 1kg']);

    finalItems?.forEach(item => {
        const emoji = item.name.includes('Granola') ? '📦' : '🔵';
        console.log(`${emoji} ${item.name}: R$ ${item.avg_cost.toFixed(2)}/${item.uom}`);
    });

    console.log('\n\n📊 VALIDAÇÃO:\n');

    const granola = finalItems?.find(i => i.name.includes('Granola'));
    const expectedCost = correctCost * 2; // 2kg de Aveia

    console.log(`Custo da Aveia: R$ ${correctCost.toFixed(2)}/kg`);
    console.log(`Custo esperado da Granola: R$ ${expectedCost.toFixed(2)} (2kg × R$ ${correctCost.toFixed(2)})`);
    console.log(`Custo atual da Granola: R$ ${granola?.avg_cost.toFixed(2)}`);

    if (granola && Math.abs(granola.avg_cost - expectedCost) < 0.01) {
        console.log('\n✅✅✅ SUCESSO! Custos corrigidos!');
    } else {
        console.log('\n❌ Ainda há discrepância.');
    }
}

forceFixCosts().catch(console.error);
