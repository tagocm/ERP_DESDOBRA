import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixExistingCosts() {
    console.log('=== CORRIGINDO CUSTOS EXISTENTES COM CONVERSÃO ===\n');

    const companyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

    // 1. Buscar último pedido de compra recebido de cada item
    const { data: items } = await supabase
        .from('items')
        .select('id, name, sku, uom, type, avg_cost')
        .eq('company_id', companyId)
        .in('type', ['raw_material', 'packaging'])
        .eq('is_active', true)
        .is('deleted_at', null);

    console.log(`Itens de matéria-prima/embalagem: ${items?.length || 0}\n`);

    let updated = 0;

    for (const item of items || []) {
        // Get last received purchase for this item
        const { data: lastPO } = await supabase
            .from('purchase_order_items')
            .select(`
                unit_cost,
                conversion_factor,
                purchase_orders!inner(status, ordered_at)
            `)
            .eq('item_id', item.id)
            .eq('purchase_orders.status', 'received')
            .order('purchase_orders.ordered_at', { ascending: false })
            .limit(1)
            .single();

        if (lastPO && lastPO.unit_cost > 0 && lastPO.conversion_factor > 0) {
            const correctCost = lastPO.unit_cost / lastPO.conversion_factor;

            if (Math.abs(item.avg_cost - correctCost) > 0.01) {
                console.log(`📦 ${item.name} (${item.sku})`);
                console.log(`   Custo atual: R$ ${item.avg_cost.toFixed(2)}/${item.uom}`);
                console.log(`   Custo correto: R$ ${correctCost.toFixed(2)}/${item.uom}`);
                console.log(`   (R$ ${lastPO.unit_cost} / ${lastPO.conversion_factor})`);

                await supabase.rpc('update_item_cost', {
                    p_item_id: item.id,
                    p_new_cost: correctCost
                });

                // Recalculate dependents
                await supabase.rpc('recalculate_dependent_costs', {
                    p_component_id: item.id
                });

                updated++;
                console.log(`   ✅ Atualizado\n`);
            }
        }
    }

    console.log(`\n📊 RESUMO: ${updated} itens atualizados`);

    // Show final costs
    console.log('\n\n' + '='.repeat(80));
    console.log('CUSTOS FINAIS:');
    console.log('='.repeat(80) + '\n');

    const { data: finalItems } = await supabase
        .from('items')
        .select('name, sku, type, uom, avg_cost')
        .eq('company_id', companyId)
        .in('type', ['raw_material', 'packaging', 'finished_good'])
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('type', { ascending: false });

    finalItems?.forEach(item => {
        const emoji = item.type === 'finished_good' ? '📦' :
            item.type === 'raw_material' ? '🔵' : '📦';
        console.log(`${emoji} ${item.name} (${item.sku}): R$ ${item.avg_cost.toFixed(2)}/${item.uom}`);
    });

    console.log('\n✅ CONCLUÍDO!');
}

fixExistingCosts().catch(console.error);
