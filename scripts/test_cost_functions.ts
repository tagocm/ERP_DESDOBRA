import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCostFunctions() {
    console.log('=== TESTE DAS FUNÇÕES DE CUSTEIO ===\n');

    const companyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

    // 1. Ver custos atuais
    console.log('1️⃣ CUSTOS ATUAIS:\n');

    const { data: items } = await supabase
        .from('items')
        .select('id, name, sku, type, avg_cost')
        .eq('company_id', companyId)
        .in('type', ['raw_material', 'finished_good'])
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('type', { ascending: false });

    items?.forEach(item => {
        const emoji = item.type === 'finished_good' ? '📦' : '🔵';
        console.log(`${emoji} ${item.name} (${item.sku}): R$ ${item.avg_cost.toFixed(2)}`);
    });

    const aveiaItem = items?.find(i => i.name.toLowerCase().includes('aveia'));
    const granolaItem = items?.find(i => i.name.toLowerCase().includes('granola'));

    if (!aveiaItem || !granolaItem) {
        console.log('\n❌ Itens não encontrados!');
        return;
    }

    // 2. Testar função de cálculo de custo de produto acabado
    console.log('\n\n2️⃣ TESTE: Calculando custo da Granola via função...\n');

    const { data: calculatedCost, error: calcError } = await supabase
        .rpc('calculate_finished_good_cost', {
            p_item_id: granolaItem.id
        });

    if (calcError) {
        console.error('Erro ao calcular custo:', calcError);
        return;
    }

    console.log(`   Custo calculado: R$ ${calculatedCost.toFixed(2)}`);
    console.log(`   Custo atual no banco: R$ ${granolaItem.avg_cost.toFixed(2)}`);
    console.log(`   ${Math.abs(calculatedCost - granolaItem.avg_cost) < 0.01 ? '✅' : '⚠️'} ` +
        (Math.abs(calculatedCost - granolaItem.avg_cost) < 0.01 ? 'Valores coincidem' : 'Valores diferentes'));

    // 3. Testar atualização manual de custo
    console.log('\n\n3️⃣ TESTE: Atualizando custo da Aveia manualmente para R$ 150,00...\n');

    const { error: updateError } = await supabase.rpc('update_item_cost', {
        p_item_id: aveiaItem.id,
        p_new_cost: 150.00
    });

    if (updateError) {
        console.error('Erro ao atualizar custo:', updateError);
        return;
    }

    console.log('   ✅ Custo da Aveia atualizado');

    // 4. Recalcular produtos dependentes
    console.log('\n4️⃣ Recalculando produtos dependentes...\n');

    const { error: recalcError } = await supabase.rpc('recalculate_dependent_costs', {
        p_component_id: aveiaItem.id
    });

    if (recalcError) {
        console.error('Erro ao recalcular dependentes:', recalcError);
        return;
    }

    console.log('   ✅ Recálculo executado');

    // Wait for updates
    await new Promise(resolve => setTimeout(resolve, 500));

    // 5. Verificar novos custos
    console.log('\n5️⃣ CUSTOS APÓS RECÁLCULO:\n');

    const { data: updatedItems } = await supabase
        .from('items')
        .select('id, name, avg_cost')
        .in('id', [aveiaItem.id, granolaItem.id]);

    updatedItems?.forEach(item => {
        const oldCost = items?.find(i => i.id === item.id)?.avg_cost || 0;
        const emoji = item.id === aveiaItem.id ? '🔵' : '📦';
        const change = item.avg_cost - oldCost;
        const changeStr = change !== 0 ? ` (${change > 0 ? '+' : ''}R$ ${change.toFixed(2)})` : '';

        console.log(`${emoji} ${item.name}: R$ ${item.avg_cost.toFixed(2)}${changeStr}`);
    });

    // 6. Validação
    console.log('\n6️⃣ VALIDAÇÃO:\n');

    const updatedGranola = updatedItems?.find(i => i.id === granolaItem.id);
    const updatedAveia = updatedItems?.find(i => i.id === aveiaItem.id);
    const expectedGranolaCost = (updatedAveia?.avg_cost || 0) * 2;

    console.log(`   Custo da Aveia: R$ ${updatedAveia?.avg_cost.toFixed(2)}`);
    console.log(`   Custo esperado da Granola: R$ ${expectedGranolaCost.toFixed(2)} (2 kg × custo Aveia)`);
    console.log(`   Custo atual da Granola: R$ ${updatedGranola?.avg_cost.toFixed(2)}`);

    if (Math.abs((updatedGranola?.avg_cost || 0) - expectedGranolaCost) < 0.01) {
        console.log('\n   ✅ SUCESSO! O sistema de custeio está funcionando corretamente!');
    } else {
        console.log('\n   ❌ ERRO! O custo não foi calculado corretamente.');
    }

    // 7. Restaurar custo original da Aveia
    console.log('\n7️⃣ Restaurando custo original da Aveia...\n');

    await supabase.rpc('update_item_cost', {
        p_item_id: aveiaItem.id,
        p_new_cost: 105.00
    });

    await supabase.rpc('recalculate_dependent_costs', {
        p_component_id: aveiaItem.id
    });

    console.log('   ✅ Custos restaurados');

    console.log('\n\n✅ TESTE CONCLUÍDO!');
}

testCostFunctions().catch(console.error);
