import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeBOMStructure() {
    console.log('=== ANÁLISE DETALHADA DO BOM ===\n');

    // Buscar o BOM da Granola
    const { data: granola } = await supabase
        .from('items')
        .select('*')
        .ilike('name', '%granola%tradicional%')
        .single();

    if (!granola) {
        console.log('Granola não encontrada!');
        return;
    }

    console.log('PRODUTO:');
    console.log(`  Nome: ${granola.name}`);
    console.log(`  SKU: ${granola.sku}`);
    console.log(`  ID: ${granola.id}\n`);

    // Buscar BOMs
    const { data: boms } = await supabase
        .from('bom_headers')
        .select('*')
        .eq('item_id', granola.id);

    console.log(`BOMs encontrados: ${boms?.length || 0}\n`);

    for (const bom of boms || []) {
        console.log(`\n━━━ BOM ID: ${bom.id} ━━━`);
        console.log(`Versão: ${bom.version}`);
        console.log(`Yield (Rendimento): ${bom.yield_qty}`);
        console.log(`Ativo: ${bom.is_active}`);

        // Buscar linhas do BOM
        const { data: lines } = await supabase
            .from('bom_lines')
            .select('*')
            .eq('bom_id', bom.id)
            .order('created_at', { ascending: true });

        console.log(`\nComponentes (${lines?.length || 0}):`);

        for (const line of lines || []) {
            const { data: comp } = await supabase
                .from('items')
                .select('*')
                .eq('id', line.component_item_id)
                .single();

            const isAveia = comp?.name?.toLowerCase().includes('aveia');
            console.log(`  ${isAveia ? '🔵' : '  '} ID: ${line.id}`);
            console.log(`     Componente: ${comp?.name} (${comp?.sku})`);
            console.log(`     Quantidade: ${line.qty} ${comp?.uom}`);
            console.log(`     Criado em: ${line.created_at}`);
        }
    }


    // Verificar se há duplicação
    console.log('\n\n' + '='.repeat(80));
    console.log('VERIFICAÇÃO DE DUPLICAÇÃO');
    console.log('='.repeat(80) + '\n');

    for (const bom of boms || []) {
        const { data: lines } = await supabase
            .from('bom_lines')
            .select('component_item_id, qty')
            .eq('bom_id', bom.id);

        const componentCounts = new Map<string, number>();
        lines?.forEach(line => {
            const count = componentCounts.get(line.component_item_id) || 0;
            componentCounts.set(line.component_item_id, count + 1);
        });

        console.log(`BOM ${bom.id}:`);
        for (const [itemId, count] of componentCounts.entries()) {
            if (count > 1) {
                const { data: item } = await supabase
                    .from('items')
                    .select('name, sku')
                    .eq('id', itemId)
                    .single();

                console.log(`  ⚠️  DUPLICADO: ${(item as any)?.name} aparece ${count} vezes!`);
            }
        }
    }


    // Verificar cálculo atual
    console.log('\n\n' + '='.repeat(80));
    console.log('CÁLCULO DE CONSUMO ATUAL (COM DUPLICAÇÃO)');
    console.log('='.repeat(80) + '\n');

    const { data: activeWOs } = await supabase
        .from('work_orders')
        .select('*')
        .eq('item_id', granola.id)
        .in('status', ['planned', 'in_progress'])
        .is('deleted_at', null);

    console.log(`Ordens ativas: ${activeWOs?.length || 0}\n`);

    let totalWithDuplicates = 0;
    let totalWithoutDuplicates = 0;

    for (const wo of activeWOs || []) {
        const remaining = Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0));

        if (wo.bom_id) {
            const { data: bomHeader } = await supabase
                .from('bom_headers')
                .select('yield_qty')
                .eq('id', wo.bom_id)
                .single();

            const { data: lines } = await supabase
                .from('bom_lines')
                .select('qty, component_item_id')
                .eq('bom_id', wo.bom_id);

            // Com duplicação (método atual - errado)
            let consumptionWithDup = 0;
            lines?.forEach(line => {
                const { data: comp } = supabase
                    .from('items')
                    .select('name')
                    .eq('id', line.component_item_id)
                    .single()
                    .then(result => {
                        if (result.data?.name?.toLowerCase().includes('aveia')) {
                            const mult = remaining / (bomHeader?.yield_qty || 1);
                            consumptionWithDup += line.qty * mult;
                        }
                    });
            });

            // Aguardar todos os checks
            await Promise.all(lines?.map(async line => {
                const { data: comp } = await supabase
                    .from('items')
                    .select('name')
                    .eq('id', line.component_item_id)
                    .single();

                if (comp?.name?.toLowerCase().includes('aveia')) {
                    const mult = remaining / (bomHeader?.yield_qty || 1);
                    consumptionWithDup += line.qty * mult;
                }
            }) || []);

            // Sem duplicação (agrupando por component_id)
            const grouped = new Map<string, number>();
            lines?.forEach(line => {
                const current = grouped.get(line.component_item_id) || 0;
                grouped.set(line.component_item_id, current + line.qty);
            });

            let consumptionWithoutDup = 0;
            for (const [compId, qty] of grouped.entries()) {
                const { data: comp } = await supabase
                    .from('items')
                    .select('name')
                    .eq('id', compId)
                    .single();

                if (comp?.name?.toLowerCase().includes('aveia')) {
                    const mult = remaining / (bomHeader?.yield_qty || 1);
                    consumptionWithoutDup += qty * mult;
                }
            }

            console.log(`WO #${wo.id.substring(0, 8)}... (Falta: ${remaining})`);
            console.log(`  Com duplicação: ${consumptionWithDup.toFixed(3)} kg`);
            console.log(`  Sem duplicação: ${consumptionWithoutDup.toFixed(3)} kg`);

            totalWithDuplicates += consumptionWithDup;
            totalWithoutDuplicates += consumptionWithoutDup;
        }
    }

    console.log(`\n📊 TOTAL COM DUPLICAÇÃO: ${totalWithDuplicates.toFixed(3)} kg`);
    console.log(`📊 TOTAL SEM DUPLICAÇÃO: ${totalWithoutDuplicates.toFixed(3)} kg`);
    console.log(`🎯 Diferença: ${(totalWithDuplicates - totalWithoutDuplicates).toFixed(3)} kg`);
}

analyzeBOMStructure().catch(console.error);
