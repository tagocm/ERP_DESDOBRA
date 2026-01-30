import { createClient } from '@supabase/supabase-js';
import { getPurchaseNeeds } from '../lib/purchases/needs-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFixedCalculation() {
    console.log('=== TESTANDO CÁLCULO CORRIGIDO ===\n');

    const { data: companies } = await supabase
        .from('companies')
        .select('id, name');

    const companyId = companies?.find(c => c.name.includes('Martigran Industria'))?.id;

    if (!companyId) {
        console.log('Company não encontrada!');
        return;
    }

    console.log(`Company: ${companyId}\n`);

    // Simular o mesmo período da tela
    const params = {
        companyId,
        startDate: new Date('2024-10-20'),
        endDate: new Date('2026-01-22'),
        includeRaw: true,
        includePackaging: true,
    };

    console.log('Parâmetros:');
    console.log(`  Período: ${params.startDate.toISOString().split('T')[0]} a ${params.endDate.toISOString().split('T')[0]}`);
    console.log(`  Matéria-prima: ${params.includeRaw}`);
    console.log(`  Embalagens: ${params.includePackaging}\n`);

    try {
        const results = await getPurchaseNeeds(supabase, params);

        console.log(`\n✅ Cálculo executado com sucesso!`);
        console.log(`Total de itens: ${results.length}\n`);

        // Encontrar Aveia
        const aveia = results.find(r => r.item_name.toLowerCase().includes('aveia'));

        if (aveia) {
            console.log('🔵 AVEIA ENCONTRADA:\n');
            console.log('━'.repeat(60));
            console.log(`Item: ${aveia.item_name} (SKU: ${aveia.item_sku})`);
            console.log(`Tipo: ${aveia.item_type}`);
            console.log(`UOM: ${aveia.uom}`);
            console.log('');
            console.log(`📦 Estoque Atual: ${aveia.stock_current.toFixed(3)} kg`);
            console.log(`📉 Estoque Mínimo: ${aveia.stock_min}`);
            console.log(`🔄 Ponto de Pedido: ${aveia.reorder_point ?? 'N/A'}`);
            console.log('');
            console.log(`💥 CONSUMO PREVISTO: ${aveia.consumption_forecast.toFixed(3)} kg`);
            console.log(`📊 Estoque Projetado: ${aveia.stock_projected.toFixed(3)} kg`);
            console.log(`🛒 Sugestão de Compra: ${aveia.purchase_suggestion.toFixed(3)} kg`);
            console.log('━'.repeat(60));

            console.log('\n📋 VERIFICAÇÃO:\n');
            console.log(`Consumo esperado: 320.000 kg (160 kg Granola × 2 kg Aveia/kg)`);
            console.log(`Consumo calculado: ${aveia.consumption_forecast.toFixed(3)} kg`);

            if (Math.abs(aveia.consumption_forecast - 320) < 1) {
                console.log('✅ CORRETO! O consumo está batendo com o esperado.');
            } else {
                console.log(`❌ ERRO! Diferença de ${Math.abs(aveia.consumption_forecast - 320).toFixed(3)} kg`);
            }
        } else {
            console.log('❌ Aveia não encontrada nos resultados!');
        }

        // Mostrar todos os itens para debug
        console.log('\n\n📋 TODOS OS ITENS COM CONSUMO:\n');
        results
            .filter(r => r.consumption_forecast > 0)
            .forEach(item => {
                console.log(`- ${item.item_name.padEnd(30)} | ${item.consumption_forecast.toFixed(3)} ${item.uom}`);
            });

    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

testFixedCalculation().catch(console.error);
