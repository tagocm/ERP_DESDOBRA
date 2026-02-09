import { createClient } from '@supabase/supabase-js';

// Script to debug why consumption forecast for Aveia (Item SKU: 2 KG) is showing 1,722

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAveiaConsumption() {
    console.log('=== DEBUG: Aveia Consumption Forecast ===\n');

    // 1. Find the Aveia item
    const { data: aveiaItem } = await supabase
        .from('items')
        .select('id, name, sku, type, uom')
        .ilike('name', '%aveia%')
        .limit(10);

    console.log('1. Aveia Items Found:');
    console.log(aveiaItem);
    console.log('\n');

    if (!aveiaItem || aveiaItem.length === 0) {
        console.log('No Aveia items found!');
        return;
    }

    const aveiaId = aveiaItem[0].id;
    console.log(`Using Item: ${aveiaItem[0].name} (ID: ${aveiaId})\n`);

    // 2. Check current stock
    const { data: movements } = await supabase
        .from('inventory_movements')
        .select('qty_in, qty_out, movement_type, created_at')
        .eq('item_id', aveiaId)
        .order('created_at', { ascending: false })
        .limit(20);

    let stockBalance = 0;
    movements?.forEach(m => {
        stockBalance += (m.qty_in || 0) - (m.qty_out || 0);
    });

    console.log('2. Current Stock Balance:', stockBalance);
    console.log('Recent movements:', movements?.length || 0);
    console.log('\n');

    // 3. Find all BOMs that use Aveia
    const { data: bomLines } = await supabase
        .from('bom_lines')
        .select(`
            id,
            bom_id,
            qty,
            bom_headers!inner (
                id,
                item_id,
                version,
                yield_qty,
                is_active,
                items (
                    id,
                    name,
                    sku
                )
            )
        `)
        .eq('component_item_id', aveiaId)
        .eq('bom_headers.is_active', true);

    console.log('3. BOMs using Aveia as component:');
    console.log(`Found ${bomLines?.length || 0} BOM lines\n`);

    bomLines?.forEach((line: any) => {
        const bom = line.bom_headers;
        console.log(`  - BOM ID: ${bom.id}`);
        console.log(`    Product: ${bom.items?.name} (SKU: ${bom.items?.sku})`);
        console.log(`    Version: ${bom.version}`);
        console.log(`    Yield: ${bom.yield_qty}`);
        console.log(`    Aveia Qty per batch: ${line.qty}`);
        console.log('');
    });

    // 4. Find Work Orders that would consume Aveia
    const bomIds = bomLines?.map((l: any) => l.bom_id) || [];
    const finishedGoodIds = bomLines?.map((l: any) => l.bom_headers.item_id) || [];

    console.log('\n4. Checking Work Orders...');
    console.log(`Searching for work orders with BOM IDs: ${bomIds.join(', ')}`);
    console.log(`Or for items: ${finishedGoodIds.join(', ')}\n`);

    const { data: workOrders } = await supabase
        .from('work_orders')
        .select(`
            id,
            item_id,
            bom_id,
            planned_qty,
            produced_qty,
            status,
            scheduled_date,
            items (
                id,
                name,
                sku,
                type
            )
        `)
        .in('status', ['planned', 'in_progress'])
        .or(`bom_id.in.(${bomIds.join(',')}),item_id.in.(${finishedGoodIds.join(',')})`)
        .order('scheduled_date', { ascending: true });

    console.log(`Found ${workOrders?.length || 0} relevant Work Orders:\n`);

    let totalAveiaConsumption = 0;

    if (workOrders && workOrders.length > 0) {
        // For each work order, calculate Aveia consumption
        for (const wo of workOrders) {
            const item = wo.items as any;
            console.log(`--- Work Order #${wo.id} ---`);
            console.log(`  Product: ${item?.name} (${item?.sku})`);
            console.log(`  Status: ${wo.status}`);
            console.log(`  Scheduled: ${wo.scheduled_date}`);
            console.log(`  Planned Qty: ${wo.planned_qty}`);
            console.log(`  Produced Qty: ${wo.produced_qty || 0}`);

            const remaining = Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0));
            console.log(`  Remaining to produce: ${remaining}`);

            // Find the BOM for this WO
            let bomId = wo.bom_id;
            if (!bomId && item) {
                // Fallback to default BOM
                const bomForItem = bomLines?.find((bl: any) => bl.bom_headers.item_id === item.id);
                bomId = bomForItem?.bom_id;
            }

            if (bomId) {
                const bomLine = bomLines?.find((bl: any) => bl.bom_id === bomId);
                if (bomLine) {
                    const bom = bomLine.bom_headers as any;
                    const yieldQty = bom.yield_qty || 1;
                    const multiplier = remaining / yieldQty;
                    const aveiaNeeded = (bomLine.qty || 0) * multiplier;

                    console.log(`  BOM Yield: ${yieldQty}`);
                    console.log(`  Multiplier: ${multiplier.toFixed(4)}`);
                    console.log(`  Aveia per batch: ${bomLine.qty}`);
                    console.log(`  AVEIA NEEDED: ${aveiaNeeded.toFixed(3)}`);

                    totalAveiaConsumption += aveiaNeeded;
                } else {
                    console.log(`  ⚠️ BOM not found for this WO`);
                }
            } else {
                console.log(`  ⚠️ No BOM assigned to this WO`);
            }

            console.log('');
        }

        console.log('\n=== SUMMARY ===');
        console.log(`Total Aveia Consumption Forecast: ${totalAveiaConsumption.toFixed(3)}`);
        console.log(`Current Stock: ${stockBalance}`);
        console.log(`Projected Stock: ${(stockBalance - totalAveiaConsumption).toFixed(3)}`);

    } else {
        console.log('⚠️ NO WORK ORDERS FOUND!');
        console.log('This explains why the user is questioning the 1,722 consumption.');
        console.log('The consumption might be coming from:');
        console.log('  1. Work orders outside the date range but still pending');
        console.log('  2. Work orders that were scheduled in the past');
        console.log('  3. Database inconsistency');
    }

    console.log('\n5. Checking ALL pending work orders (no date filter)...\n');

    const { data: allWorkOrders } = await supabase
        .from('work_orders')
        .select(`
            id,
            item_id,
            bom_id,
            planned_qty,
            produced_qty,
            status,
            scheduled_date,
            items (name, sku)
        `)
        .in('status', ['planned', 'in_progress'])
        .or(`bom_id.in.(${bomIds.join(',')}),item_id.in.(${finishedGoodIds.join(',')})`)
        .order('scheduled_date', { ascending: true });

    console.log(`Total pending WOs (all dates): ${allWorkOrders?.length || 0}`);

    let totalAllDates = 0;
    allWorkOrders?.forEach(wo => {
        const remaining = Math.max(0, (wo.planned_qty || 0) - (wo.produced_qty || 0));
        const bomLine = bomLines?.find((bl: any) => bl.bom_id === wo.bom_id);
        if (bomLine) {
            const bom = bomLine.bom_headers as any;
            const yieldQty = bom.yield_qty || 1;
            const multiplier = remaining / yieldQty;
            const aveiaNeeded = (bomLine.qty || 0) * multiplier;
            totalAllDates += aveiaNeeded;

            console.log(`  ${wo.scheduled_date} | ${(wo.items as any)?.name} | Qty: ${remaining} | Aveia: ${aveiaNeeded.toFixed(3)}`);
        }
    });

    console.log(`\nTotal consumption (all dates): ${totalAllDates.toFixed(3)}`);
}

debugAveiaConsumption().catch(console.error);
