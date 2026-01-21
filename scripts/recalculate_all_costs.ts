import { createClient } from '@supabase/supabase-js';

// Script to recalculate all item costs
// Run this once after deploying the automatic costing system

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function recalculateAllCosts() {
    console.log('=== RECÁLCULO DE CUSTOS - INICIANDO ===\n');

    try {
        // Get all companies
        const { data: companies } = await supabase
            .from('companies')
            .select('id, name');

        if (!companies || companies.length === 0) {
            console.log('Nenhuma empresa encontrada.');
            return;
        }

        for (const company of companies) {
            console.log(`\n📊 Empresa: ${company.name}`);
            console.log('━'.repeat(60));

            // Step 1: Update raw materials from last purchase
            console.log('\n1️⃣  Atualizando matérias-primas da última compra...');

            const { data: lastPurchases } = await supabase.rpc('get_last_purchase_costs', {
                p_company_id: company.id
            });

            let rawMaterialsUpdated = 0;

            // Fallback: update manually if RPC doesn't exist
            const { data: receivedOrders } = await supabase
                .from('purchase_orders')
                .select(`
                    id,
                    items:purchase_order_items(item_id, unit_cost)
                `)
                .eq('company_id', company.id)
                .eq('status', 'received')
                .order('ordered_at', { ascending: false });

            const latestCosts = new Map<string, number>();

            receivedOrders?.forEach((order: any) => {
                order.items?.forEach((item: any) => {
                    if (item.unit_cost > 0 && !latestCosts.has(item.item_id)) {
                        latestCosts.set(item.item_id, item.unit_cost);
                    }
                });
            });

            for (const [itemId, cost] of latestCosts.entries()) {
                await supabase.rpc('update_item_cost', {
                    p_item_id: itemId,
                    p_new_cost: cost
                });
                rawMaterialsUpdated++;
            }

            console.log(`   ✅ ${rawMaterialsUpdated} matérias-primas atualizadas`);

            // Step 2: Calculate finished goods costs
            console.log('\n2️⃣  Calculando custos de produtos acabados...');

            const { data: finishedGoods } = await supabase
                .from('items')
                .select('id, name, sku, avg_cost')
                .eq('company_id', company.id)
                .eq('type', 'finished_good')
                .eq('is_active', true)
                .is('deleted_at', null);

            let finishedGoodsUpdated = 0;

            for (const item of finishedGoods || []) {
                // Calculate new cost
                const { data: newCost } = await supabase.rpc('calculate_finished_good_cost', {
                    p_item_id: item.id
                });

                if (newCost !== null && newCost !== item.avg_cost) {
                    await supabase.rpc('update_item_cost', {
                        p_item_id: item.id,
                        p_new_cost: newCost
                    });

                    console.log(`   📦 ${item.name} (${item.sku}): R$ ${item.avg_cost.toFixed(2)} → R$ ${newCost.toFixed(2)}`);
                    finishedGoodsUpdated++;
                }
            }

            console.log(`   ✅ ${finishedGoodsUpdated} produtos acabados atualizados`);
        }

        console.log('\n\n✅ RECÁLCULO CONCLUÍDO COM SUCESSO!');

    } catch (error) {
        console.error('\n❌ ERRO durante recálculo:', error);
        throw error;
    }
}

// Run if executed directly
if (require.main === module) {
    recalculateAllCosts()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export { recalculateAllCosts };
