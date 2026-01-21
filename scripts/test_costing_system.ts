import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCostingSystem() {
    console.log('=== TESTE DO SISTEMA DE CUSTEIO AUTOMÁTICO ===\n');

    const companyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569'; // Martigran Industria

    // 1. Verificar custos atuais
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

    // 2. Simular criação de novo pedido de compra de Aveia com custo diferente
    console.log('\n\n2️⃣ TESTE: Criando pedido de compra de Aveia com custo R$ 120,00/kg...\n');

    const aveiaItem = items?.find(i => i.name.toLowerCase().includes('aveia'));

    if (!aveiaItem) {
        console.log('❌ Aveia não encontrada!');
        return;
    }

    // Create purchase order
    // First, get a supplier
    const { data: supplier } = await supabase
        .from('organizations')
        .select('id')
        .eq('company_id', companyId)
        .eq('type', 'supplier')
        .limit(1)
        .single();

    const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
            company_id: companyId,
            supplier_id: supplier?.id || null,
            status: 'draft',
            notes: 'Teste de custeio automático'
        })
        .select()
        .single();

    if (poError || !po) {
        console.error('Erro ao criar PO:', poError);
        return;
    }

    console.log(`   📝 PO criado: ${po.id.substring(0, 8)}...`);

    // Add item to PO
    const { error: itemError } = await supabase
        .from('purchase_order_items')
        .insert({
            company_id: companyId,
            purchase_order_id: po.id,
            item_id: aveiaItem.id,
            qty_display: 100,
            uom_label: 'Kg',
            conversion_factor: 1,
            qty_base: 100,
            unit_cost: 120.00,
            total_cost: 12000.00
        });

    if (itemError) {
        console.error('Erro ao adicionar item:', itemError);
        return;
    }

    console.log(`   ✅ Item adicionado: 100 kg de Aveia @ R$ 120,00/kg`);

    // Mark as received
    console.log('\n3️⃣ Marcando pedido como recebido (trigger deve atualizar custos)...\n');

    const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ status: 'received' })
        .eq('id', po.id);

    if (updateError) {
        console.error('Erro ao atualizar status:', updateError);
        return;
    }

    console.log('   ✅ Status atualizado para "received"');

    // Wait a bit for triggers to execute
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Verificar novos custos
    console.log('\n4️⃣ CUSTOS APÓS RECEBIMENTO:\n');

    const { data: updatedItems } = await supabase
        .from('items')
        .select('id, name, sku, avg_cost')
        .eq('company_id', companyId)
        .in('id', [aveiaItem.id, items?.find(i => i.type === 'finished_good')?.id].filter(Boolean));

    updatedItems?.forEach(item => {
        const oldCost = items?.find(i => i.id === item.id)?.avg_cost || 0;
        const emoji = item.name.toLowerCase().includes('aveia') ? '🔵' : '📦';
        const change = item.avg_cost - oldCost;
        const changeStr = change !== 0 ? ` (${change > 0 ? '+' : ''}R$ ${change.toFixed(2)})` : '';

        console.log(`${emoji} ${item.name}: R$ ${item.avg_cost.toFixed(2)}${changeStr}`);
    });

    // 5. Validar cálculo esperado
    console.log('\n5️⃣ VALIDAÇÃO:\n');

    const granolaItem = updatedItems?.find(i => !i.name.toLowerCase().includes('aveia'));
    const expectedGranolaCost = 120.00 * 2; // 2 kg de Aveia por kg de Granola

    if (granolaItem) {
        console.log(`   Custo esperado da Granola: R$ ${expectedGranolaCost.toFixed(2)}`);
        console.log(`   Custo calculado: R$ ${granolaItem.avg_cost.toFixed(2)}`);

        if (Math.abs(granolaItem.avg_cost - expectedGranolaCost) < 0.01) {
            console.log('   ✅ CORRETO! O custo foi calculado automaticamente.');
        } else {
            console.log('   ❌ ERRO! O custo não bate com o esperado.');
        }
    }

    // Cleanup: delete test PO
    console.log('\n6️⃣ Limpando dados de teste...\n');

    await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', po.id);

    console.log('   ✅ Pedido de teste removido');

    console.log('\n\n✅ TESTE CONCLUÍDO!');
}

testCostingSystem().catch(console.error);
