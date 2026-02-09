import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAllAveiaData() {
    console.log('=== COMPLETE AVEIA DEBUG ===\n');

    // Get Aveia ID
    const { data: aveiaItem } = await supabase
        .from('items')
        .select('*')
        .ilike('name', '%aveia%')
        .single();

    if (!aveiaItem) {
        console.log('Aveia not found!');
        return;
    }

    const aveiaId = aveiaItem.id;
    console.log('1. AVEIA ITEM:');
    console.log(aveiaItem);
    console.log('\n');

    // Check ALL BOM lines (including inactive BOMs)
    const { data: allBomLines } = await supabase
        .from('bom_lines')
        .select(`
            *,
            bom_headers (
                *,
                items (
                    id,
                    name,
                    sku,
                    type
                )
            )
        `)
        .eq('component_item_id', aveiaId);

    console.log('2. ALL BOM LINES (including inactive):');
    console.log(`Found ${allBomLines?.length || 0} BOM lines\n`);

    allBomLines?.forEach((line: any) => {
        const bom = line.bom_headers;
        console.log(`  BOM ID: ${bom.id}`);
        console.log(`  Product: ${bom.items?.name} (${bom.items?.sku})`);
        console.log(`  Active: ${bom.is_active}`);
        console.log(`  Version: ${bom.version}`);
        console.log(`  Yield: ${bom.yield_qty}`);
        console.log(`  Aveia Qty: ${line.qty}`);
        console.log('  ---');
    });

    // Check ALL work orders (all statuses, all dates)
    const bomIds = allBomLines?.map((l: any) => l.bom_id) || [];
    const itemIds = allBomLines?.map((l: any) => l.bom_headers.item_id) || [];

    console.log('\n3. ALL WORK ORDERS (all statuses):');

    if (bomIds.length > 0) {
        const { data: allWOs } = await supabase
            .from('work_orders')
            .select(`
                *,
                items (
                    name,
                    sku
                )
            `)
            .or(`bom_id.in.(${bomIds.join(',')}),item_id.in.(${itemIds.join(',')})`)
            .order('scheduled_date', { ascending: false });

        console.log(`Found ${allWOs?.length || 0} work orders\n`);

        let totalConsumption = 0;

        allWOs?.forEach(wo => {
            const item = wo.items as any;
            const remaining = Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0));

            // Find BOM line
            const bomLine = allBomLines?.find((bl: any) => bl.bom_id === wo.bom_id);
            let aveiaNeeded = 0;

            if (bomLine) {
                const bom = bomLine.bom_headers;
                const yieldQty = bom.yield_qty || 1;
                const multiplier = remaining / yieldQty;
                aveiaNeeded = (bomLine.qty || 0) * multiplier;
                totalConsumption += aveiaNeeded;
            }

            console.log(`WO #${wo.id}`);
            console.log(`  Product: ${item?.name} (${item?.sku})`);
            console.log(`  Status: ${wo.status}`);
            console.log(`  Date: ${wo.scheduled_date}`);
            console.log(`  Planned: ${wo.planned_qty} | Produced: ${wo.produced_qty || 0} | Remaining: ${remaining}`);
            console.log(`  Aveia needed: ${aveiaNeeded.toFixed(3)}`);
            console.log('');
        });

        console.log(`\nTOTAL AVEIA CONSUMPTION: ${totalConsumption.toFixed(3)}`);
    } else {
        console.log('No BOMs found, so no work orders to check.');
    }

    // Check inventory profile
    console.log('\n4. INVENTORY PROFILE:');
    const { data: profile } = await supabase
        .from('item_inventory_profiles')
        .select('*')
        .eq('item_id', aveiaId)
        .maybeSingle();

    console.log(profile || 'No inventory profile found');

    // Check stock movements
    console.log('\n5. STOCK MOVEMENTS:');
    const { data: movements } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('item_id', aveiaId)
        .order('created_at', { ascending: false })
        .limit(10);

    console.log(`Found ${movements?.length || 0} movements`);
    movements?.forEach(m => {
        console.log(`  ${m.created_at} | ${m.movement_type} | In: ${m.qty_in || 0} | Out: ${m.qty_out || 0}`);
    });
}

debugAllAveiaData().catch(console.error);
