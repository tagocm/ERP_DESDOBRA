import { SupabaseClient } from '@supabase/supabase-js';

export type PurchaseNeedItem = {
    item_id: string;
    item_name: string;
    item_sku: string;
    item_type: string;
    uom: string;
    stock_current: number;
    stock_min: number;
    reorder_point: number | null;
    consumption_forecast: number;
    stock_projected: number;
    purchase_suggestion: number;
};

export type GetPurchaseNeedsParams = {
    companyId: string;
    startDate: Date;
    endDate: Date;
    includeRaw: boolean;
    includePackaging: boolean;
};

/**
 * Calculates purchasing needs based on production plan (Work Orders) and BOMs.
 * Only reads data, calculation on the fly.
 */
export async function getPurchaseNeeds(
    supabase: SupabaseClient,
    {
        companyId,
        startDate,
        endDate,
        includeRaw,
        includePackaging,
    }: GetPurchaseNeedsParams
): Promise<PurchaseNeedItem[]> {
    console.log('[NeedsService] Starting calculation...', {
        startDate,
        endDate,
        includeRaw,
        includePackaging,
    });

    // 1. Fetch relevant Work Orders
    // We include ALL 'planned' or 'in_progress' OPs up to the end date. 
    // This ensures we capture overdue/ongoing generic needs.
    const { data: workOrders, error: woError } = await supabase
        .from('work_orders')
        .select(`
            id,
            item_id,
            bom_id,
            planned_qty,
            produced_qty,
            status,
            scheduled_date,
            items!inner (
                id,
                type,
                name
            )
        `)
        .eq('company_id', companyId)
        .in('status', ['planned', 'in_progress'])
        .eq('items.type', 'finished_good')
        .not('scheduled_date', 'is', null) // Exclude orders without scheduled date
        .gte('scheduled_date', startDate.toISOString()) // Include only orders within period
        .lte('scheduled_date', endDate.toISOString())
        .is('deleted_at', null); // Exclude deleted orders

    if (woError) {
        console.error('[NeedsService] Error fetching work orders:', woError);
        throw new Error('Failed to fetch work orders');
    }

    if (!workOrders || workOrders.length === 0) {
        console.log('[NeedsService] No work orders found in period (or pending).');
        return [];
    }

    console.log(`[NeedsService] Found ${workOrders.length} work orders.`);

    // 2. Resolve BOMs
    const distinctItemIds = Array.from(new Set(workOrders.map((wo) => wo.item_id)));

    const { data: prodProfiles } = await supabase
        .from('item_production_profiles')
        .select('item_id, default_bom_id')
        .eq('company_id', companyId)
        .in('item_id', distinctItemIds);

    const profileMap = new Map<string, string>();
    prodProfiles?.forEach((p) => {
        if (p.default_bom_id) profileMap.set(p.item_id, p.default_bom_id);
    });

    const { data: bomHeadersRaw } = await supabase
        .from('bom_headers')
        .select('id, item_id, version, yield_qty, is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .in('item_id', distinctItemIds)
        .order('version', { ascending: false });

    const latestBomMap = new Map<string, any>();
    bomHeadersRaw?.forEach((bom) => {
        if (!latestBomMap.has(bom.item_id)) {
            latestBomMap.set(bom.item_id, bom);
        }
    });

    const bomIdsToFetchLines = new Set<string>();
    const woBOMMap = new Map<string, string>();

    for (const wo of workOrders) {
        let bomId = wo.bom_id;
        if (!bomId) {
            bomId = profileMap.get(wo.item_id) || null;
        }
        if (!bomId) {
            const latest = latestBomMap.get(wo.item_id);
            if (latest) bomId = latest.id;
        }

        if (bomId) {
            bomIdsToFetchLines.add(bomId);
            woBOMMap.set(wo.id, bomId);
        }
    }

    if (bomIdsToFetchLines.size === 0) {
        return [];
    }

    // 3. Fetch BOM Details
    const { data: resolvedBomHeaders, error: bomError } = await supabase
        .from('bom_headers')
        .select(`
            id, 
            yield_qty,
            bom_lines (
                component_item_id,
                qty
            )
        `)
        .in('id', Array.from(bomIdsToFetchLines));

    if (bomError) throw bomError;

    const bomLookup = new Map<string, any>();
    resolvedBomHeaders?.forEach((b) => bomLookup.set(b.id, b));

    // 4. Calculate Forecast Consumption
    const forecastMap = new Map<string, number>();

    for (const wo of workOrders) {
        const bomId = woBOMMap.get(wo.id);
        if (!bomId) continue;

        const bomStruct = bomLookup.get(bomId);
        if (!bomStruct) continue;

        const yieldQty = bomStruct.yield_qty || 1;
        if (yieldQty <= 0) continue;

        // Calculate remaining quantity to produce
        // If status is in_progress, we assume produced_qty has consumed materials.
        // We only forecast for the remainder.
        const planned = wo.planned_qty || 0;
        const produced = wo.produced_qty || 0;
        const remaining = Math.max(0, planned - produced);

        if (remaining <= 0) continue;

        const multiplier = remaining / yieldQty;

        if (bomStruct.bom_lines) {
            // Group BOM lines by component_item_id to handle duplicates
            // This prevents overcounting when a BOM has multiple lines for the same component
            const groupedComponents = new Map<string, number>();

            for (const line of bomStruct.bom_lines) {
                const componentId = line.component_item_id;
                const currentQty = groupedComponents.get(componentId) || 0;
                groupedComponents.set(componentId, currentQty + (line.qty || 0));
            }

            // Calculate consumption using grouped components
            for (const [componentId, totalQty] of groupedComponents.entries()) {
                const totalNeeded = totalQty * multiplier;
                const current = forecastMap.get(componentId) || 0;
                forecastMap.set(componentId, current + totalNeeded);
            }
        }
    }

    if (forecastMap.size === 0) {
        return [];
    }

    const componentIds = Array.from(forecastMap.keys());

    // 5. Fetch Component Details
    const typesToInclude: string[] = [];
    if (includeRaw) typesToInclude.push('raw_material');
    if (includePackaging) typesToInclude.push('packaging');

    if (typesToInclude.length === 0) return [];

    const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('id, name, sku, type, uom') // Not filtering by type here to properly map active ids, but filter later
        .in('id', componentIds)
        .eq('company_id', companyId);

    if (itemError) throw itemError;

    // Filter by requested types
    const validItems = itemData?.filter(i => typesToInclude.includes(i.type)) || [];
    const validComponentIds = validItems.map(i => i.id);

    if (validComponentIds.length === 0) return [];

    // 6. Fetch Global Info (Inventory Profiles & Stock)
    const { data: invProfiles } = await supabase
        .from('item_inventory_profiles')
        .select('item_id, min_stock, reorder_point')
        .eq('company_id', companyId)
        .in('item_id', validComponentIds);

    const profileLookup = new Map<string, any>();
    invProfiles?.forEach((p) => profileLookup.set(p.item_id, p));

    // Calculate Stock Balance Manually: SUM(qty_in) - SUM(qty_out)
    const { data: movements, error: movError } = await supabase
        .from('inventory_movements')
        .select('item_id, qty_in, qty_out')
        .eq('company_id', companyId)
        .in('item_id', validComponentIds);

    if (movError) throw movError;

    const stockMap = new Map<string, number>();
    movements?.forEach(m => {
        const current = stockMap.get(m.item_id) || 0;
        const balance = (m.qty_in || 0) - (m.qty_out || 0);
        stockMap.set(m.item_id, current + balance);
    });

    // 7. Assemble Results
    const results: PurchaseNeedItem[] = validItems.map(item => {
        const profile = profileLookup.get(item.id);
        const stockCurrent = stockMap.get(item.id) || 0;
        const consumptionForecast = forecastMap.get(item.id) || 0;

        const stockProjected = stockCurrent - consumptionForecast;

        const minStock = profile?.min_stock || 0;
        const reorderPoint = profile?.reorder_point; // can be null

        // Suggestion logic: max(0, reorder_point - projected)
        // If reorder_point is null, use min_stock
        const triggerPoint = reorderPoint !== null && reorderPoint !== undefined ? reorderPoint : minStock;
        const purchaseSuggestion = Math.max(0, triggerPoint - stockProjected);

        return {
            item_id: item.id,
            item_name: item.name,
            item_sku: item.sku || '',
            item_type: item.type,
            uom: item.uom || 'UN',
            stock_current: stockCurrent,
            stock_min: minStock,
            reorder_point: reorderPoint ?? null,
            consumption_forecast: consumptionForecast,
            stock_projected: stockProjected,
            purchase_suggestion: purchaseSuggestion
        };
    });

    return results;
}
