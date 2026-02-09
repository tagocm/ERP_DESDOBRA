import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPurchaseOrderData() {
    console.log('=== VERIFICANDO DADOS DE PEDIDOS DE COMPRA ===\n');

    const companyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

    // Buscar último pedido de compra de Aveia recebido
    const { data: orders } = await supabase
        .from('purchase_orders')
        .select(`
            id,
            status,
            ordered_at,
            items:purchase_order_items(
                id,
                item_id,
                qty_display,
                uom_label,
                conversion_factor,
                qty_base,
                unit_cost,
                total_cost,
                items(name, sku, uom)
            )
        `)
        .eq('company_id', companyId)
        .eq('status', 'received')
        .order('ordered_at', { ascending: false })
        .limit(5);

    console.log(`Pedidos de compra recebidos: ${orders?.length || 0}\n`);

    orders?.forEach((order: any) => {
        console.log(`\n━━━ PO: ${order.id.substring(0, 8)}... ━━━`);
        console.log(`Status: ${order.status}`);
        console.log(`Data: ${order.ordered_at}`);

        order.items?.forEach((item: any) => {
            console.log(`\n  Item: ${item.items.name} (${item.items.sku})`);
            console.log(`  UOM do item: ${item.items.uom}`);
            console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`  Quantidade (display): ${item.qty_display} ${item.uom_label}`);
            console.log(`  Fator de conversão: ${item.conversion_factor}`);
            console.log(`  Quantidade (base): ${item.qty_base} ${item.items.uom}`);
            console.log(`  Custo unitário: R$ ${item.unit_cost} / ${item.uom_label}`);
            console.log(`  Custo total: R$ ${item.total_cost}`);
            console.log('');
            console.log(`  📊 CÁLCULOS:`);
            console.log(`     Custo por ${item.items.uom} = R$ ${item.unit_cost} / ${item.conversion_factor}`);
            console.log(`     Custo por ${item.items.uom} = R$ ${(item.unit_cost / item.conversion_factor).toFixed(2)}`);
            console.log('');
            console.log(`  ⚠️  PROBLEMA:`);
            console.log(`     O sistema está gravando unit_cost = R$ ${item.unit_cost}`);
            console.log(`     Mas deveria gravar R$ ${(item.unit_cost / item.conversion_factor).toFixed(2)}/kg`);
        });
    });

    // Verificar custo atual da Aveia
    console.log('\n\n' + '='.repeat(80));
    console.log('CUSTO ATUAL NO BANCO:');
    console.log('='.repeat(80) + '\n');

    const { data: aveia } = await supabase
        .from('items')
        .select('id, name, sku, uom, avg_cost')
        .eq('company_id', companyId)
        .ilike('name', '%aveia%')
        .single();

    if (aveia) {
        console.log(`Item: ${aveia.name} (${aveia.sku})`);
        console.log(`UOM: ${aveia.uom}`);
        console.log(`Custo médio gravado: R$ ${aveia.avg_cost.toFixed(2)}/${aveia.uom}`);
        console.log('');
        console.log(`✅ CORRETO seria: R$ ${(105.00 / 25).toFixed(2)}/kg = R$ 4,20/kg`);
        console.log(`❌ ATUAL: R$ ${aveia.avg_cost.toFixed(2)}/kg`);
    }
}

checkPurchaseOrderData().catch(console.error);
