import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function compareWorkOrders() {
    console.log('=== COMPARANDO ORDENS DA TELA vs BANCO ===\n');

    const companyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

    // IDs visíveis na tela
    const visibleIds = [
        '955e712c',  // Planejada - 60
        '5b393398',  // Em Produção - 100
        'c13d3519',  // Em Produção - 329 (produzido)
        '693ab037',  // Cancelada - 100
        '41f8f2d0a'  // Concluída - 10
    ];

    console.log('🖥️  ORDENS VISÍVEIS NA TELA (5):\n');
    visibleIds.forEach(id => console.log(`  - ${id}`));

    // Buscar TODAS as work orders do banco
    const { data: allWOs } = await supabase
        .from('work_orders')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    console.log(`\n💾 ORDENS NO BANCO (${allWOs?.length || 0}):\n`);

    const foundInUI: any[] = [];
    const notInUI: any[] = [];

    for (const wo of allWOs || []) {
        const shortId = wo.id.substring(0, 8);
        const isVisible = visibleIds.some(id => wo.id.startsWith(id));

        const info = {
            id: shortId,
            status: wo.status,
            planned: wo.planned_qty,
            produced: wo.produced_qty || 0,
            remaining: Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0)),
            date: wo.scheduled_date,
            deleted: wo.deleted_at ? 'SIM' : 'NÃO'
        };

        if (isVisible) {
            foundInUI.push(info);
        } else {
            notInUI.push(info);
        }
    }

    console.log('✅ ENCONTRADAS NA TELA:\n');
    console.table(foundInUI);

    if (notInUI.length > 0) {
        console.log('\n⚠️  NÃO APARECEM NA TELA (mas estão no banco):\n');
        console.table(notInUI);

        console.log('\n📋 DETALHES DAS ORDENS OCULTAS:\n');
        for (const wo of allWOs || []) {
            const shortId = wo.id.substring(0, 8);
            const isVisible = visibleIds.some(id => wo.id.startsWith(id));

            if (!isVisible) {
                console.log(`\n━━━ WO #${shortId}... ━━━`);
                console.log(`  ID Completo: ${wo.id}`);
                console.log(`  Status: ${wo.status}`);
                console.log(`  Criado em: ${wo.created_at}`);
                console.log(`  Atualizado em: ${wo.updated_at}`);
                console.log(`  Deletado em: ${wo.deleted_at || 'NULL'}`);
                console.log(`  Data agendada: ${wo.scheduled_date}`);
                console.log(`  Planejado: ${wo.planned_qty}`);
                console.log(`  Produzido: ${wo.produced_qty || 0}`);
                console.log(`  BOM ID: ${wo.bom_id || 'NULL'}`);
                console.log(`  Item ID: ${wo.item_id}`);

                // Buscar nome do produto
                const { data: item } = await supabase
                    .from('items')
                    .select('name, sku')
                    .eq('id', wo.item_id)
                    .single();

                console.log(`  Produto: ${item?.name} (${item?.sku})`);
            }
        }
    }

    // Calcular consumo apenas das ordens VISÍVEIS na tela
    console.log('\n\n' + '='.repeat(80));
    console.log('CÁLCULO BASEADO APENAS NAS ORDENS VISÍVEIS NA TELA');
    console.log('='.repeat(80) + '\n');

    let consumoVisivel = 0;

    for (const wo of allWOs || []) {
        const isVisible = visibleIds.some(id => wo.id.startsWith(id));
        if (!isVisible) continue;

        const remaining = Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0));
        if (remaining <= 0) continue;
        if (!wo.bom_id) continue;

        // Buscar BOM
        const { data: bomLines } = await supabase
            .from('bom_lines')
            .select('qty, component_item_id')
            .eq('bom_id', wo.bom_id);

        // Agrupar componentes
        const grouped = new Map<string, number>();
        bomLines?.forEach(line => {
            const curr = grouped.get(line.component_item_id) || 0;
            grouped.set(line.component_item_id, curr + (line.qty || 0));
        });

        for (const [compId, qty] of grouped.entries()) {
            const { data: comp } = await supabase
                .from('items')
                .select('name')
                .eq('id', compId)
                .single();

            if (comp?.name?.toLowerCase().includes('aveia')) {
                const cons = remaining * qty;
                consumoVisivel += cons;
                console.log(`WO #${wo.id.substring(0, 8)}... | Falta: ${remaining} × ${qty} kg = ${cons} kg`);
            }
        }
    }

    console.log(`\n💥 CONSUMO (apenas ordens visíveis): ${consumoVisivel} kg`);
    console.log(`💥 CONSUMO (todas ordens do banco): 1.722 kg`);
    console.log(`📊 Diferença: ${Math.abs(1722 - consumoVisivel)} kg`);
}

compareWorkOrders().catch(console.error);
