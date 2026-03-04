import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { toDateInputValue } from '@/lib/utils';

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

type DbClient = SupabaseClient<Database>;

type ItemSummary = {
    id: string;
    name: string;
    sku: string | null;
    type: string;
    uom: string | null;
};

type WorkOrderRow = {
    id: string;
    item_id: string;
    bom_id: string | null;
    parent_work_order_id: string | null;
    planned_qty: number | null;
    produced_qty: number | null;
    scheduled_date: string | null;
    item: {
        id: string;
        type: string;
        name: string;
    } | {
        id: string;
        type: string;
        name: string;
    }[] | null;
};

type ProductionProfile = {
    item_id: string;
    is_produced: boolean | null;
    default_bom_id: string | null;
};

type ActiveBomRow = {
    id: string;
    item_id: string;
    version: number;
    yield_qty: number | null;
};

type BomLineRow = {
    component_item_id: string;
    qty: number | null;
};

type BomStructure = {
    id: string;
    item_id: string;
    yield_qty: number | null;
    bom_lines: BomLineRow[] | null;
};

type InventoryProfile = {
    item_id: string;
    min_stock: number | null;
    reorder_point: number | null;
};

type StockMovement = {
    item_id: string;
    qty_in: number | null;
    qty_out: number | null;
};

function singleRelation<T>(value: T | T[] | null): T | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

function groupBomLines(lines: BomLineRow[] | null | undefined): Map<string, number> {
    const grouped = new Map<string, number>();
    for (const line of lines ?? []) {
        const current = grouped.get(line.component_item_id) || 0;
        grouped.set(line.component_item_id, current + Number(line.qty || 0));
    }
    return grouped;
}

/**
 * Calculates purchasing needs based on production plan (Work Orders) and BOMs.
 * Only reads data, calculation on the fly.
 */
export async function getPurchaseNeeds(
    supabase: DbClient,
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

    const startDateIso = toDateInputValue(startDate);
    const endDateIso = toDateInputValue(endDate);

    // 1. Fetch relevant Work Orders
    const { data: workOrders, error: woError } = await supabase
        .from('work_orders')
        .select(`
            id,
            item_id,
            bom_id,
            parent_work_order_id,
            planned_qty,
            produced_qty,
            status,
            scheduled_date,
            item:items!inner (
                id,
                type,
                name
            )
        `)
        .eq('company_id', companyId)
        .in('status', ['planned', 'in_progress'])
        .in('items.type', ['finished_good', 'wip'])
        .not('scheduled_date', 'is', null) // Exclude orders without scheduled date
        .gte('scheduled_date', startDateIso) // Include only orders within period
        .lte('scheduled_date', endDateIso)
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
    const forecastMap = new Map<string, number>();
    const itemCache = new Map<string, ItemSummary>();
    const profileCache = new Map<string, ProductionProfile | null>();
    const activeBomByItemId = new Map<string, ActiveBomRow>();
    const bomCache = new Map<string, BomStructure>();

    const typedWorkOrders = (workOrders || []) as WorkOrderRow[];
    const workOrderIdSet = new Set(typedWorkOrders.map((wo) => wo.id));
    const rootWorkOrders = typedWorkOrders.filter(
        (wo) => !(wo.parent_work_order_id && workOrderIdSet.has(wo.parent_work_order_id))
    );

    const fetchItems = async (itemIds: string[]) => {
        const idsToLoad = Array.from(new Set(itemIds)).filter((id) => !itemCache.has(id));
        if (idsToLoad.length === 0) return;

        const { data, error } = await supabase
            .from('items')
            .select('id, name, sku, type, uom')
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .in('id', idsToLoad);

        if (error) throw error;

        for (const item of (data || []) as ItemSummary[]) {
            itemCache.set(item.id, item);
        }
    };

    const fetchProfiles = async (itemIds: string[]) => {
        const idsToLoad = Array.from(new Set(itemIds)).filter((id) => !profileCache.has(id));
        if (idsToLoad.length === 0) return;

        const { data, error } = await supabase
            .from('item_production_profiles')
            .select('item_id, is_produced, default_bom_id')
            .eq('company_id', companyId)
            .in('item_id', idsToLoad);

        if (error) throw error;

        const rows = (data || []) as ProductionProfile[];
        const profileByItem = new Map(rows.map((row) => [row.item_id, row]));

        for (const itemId of idsToLoad) {
            profileCache.set(itemId, profileByItem.get(itemId) ?? null);
        }
    };

    const fetchActiveBoms = async (itemIds: string[]) => {
        const idsToLoad = Array.from(new Set(itemIds)).filter((id) => !activeBomByItemId.has(id));
        if (idsToLoad.length === 0) return;

        const { data, error } = await supabase
            .from('bom_headers')
            .select('id, item_id, version, yield_qty')
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .eq('is_active', true)
            .in('item_id', idsToLoad)
            .order('item_id', { ascending: true })
            .order('version', { ascending: false });

        if (error) throw error;

        for (const bom of (data || []) as ActiveBomRow[]) {
            if (!activeBomByItemId.has(bom.item_id)) {
                activeBomByItemId.set(bom.item_id, bom);
            }
        }
    };

    const fetchBomStructures = async (bomIds: string[]) => {
        const idsToLoad = Array.from(new Set(bomIds)).filter((id) => !bomCache.has(id));
        if (idsToLoad.length === 0) return;

        const { data, error } = await supabase
            .from('bom_headers')
            .select(`
                id,
                item_id,
                yield_qty,
                bom_lines(
                    component_item_id,
                    qty
                )
            `)
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .in('id', idsToLoad);

        if (error) throw error;

        for (const row of (data || []) as BomStructure[]) {
            bomCache.set(row.id, row);
        }
    };

    const resolveBomId = async (itemId: string, explicitBomId?: string | null) => {
        if (explicitBomId) {
            await fetchBomStructures([explicitBomId]);
            if (bomCache.has(explicitBomId)) return explicitBomId;
        }

        await fetchProfiles([itemId]);
        const profile = profileCache.get(itemId);

        if (profile?.default_bom_id) {
            await fetchBomStructures([profile.default_bom_id]);
            if (bomCache.has(profile.default_bom_id)) return profile.default_bom_id;
        }

        await fetchActiveBoms([itemId]);
        const active = activeBomByItemId.get(itemId);
        if (!active) return null;

        await fetchBomStructures([active.id]);
        return bomCache.has(active.id) ? active.id : null;
    };

    const accumulateLeafNeed = (itemId: string, qty: number) => {
        if (qty <= 0) return;
        const current = forecastMap.get(itemId) || 0;
        forecastMap.set(itemId, current + qty);
    };

    const explodeItemDemand = async (
        itemId: string,
        requiredQty: number,
        trail: Set<string>,
        explicitBomId?: string | null
    ): Promise<void> => {
        if (requiredQty <= 0) return;

        if (trail.has(itemId)) {
            console.warn('[NeedsService] BOM cycle detected, skipping branch.', { itemId, trail: Array.from(trail) });
            return;
        }

        const bomId = await resolveBomId(itemId, explicitBomId);
        if (!bomId) return;

        const bom = bomCache.get(bomId);
        if (!bom) return;

        const yieldQty = Number(bom.yield_qty || 0);
        if (yieldQty <= 0) return;

        const grouped = groupBomLines(bom.bom_lines);
        if (grouped.size === 0) return;

        const nextTrail = new Set(trail);
        nextTrail.add(itemId);

        for (const [componentId, qtyPerBom] of grouped.entries()) {
            const componentQty = (requiredQty / yieldQty) * qtyPerBom;
            if (componentQty <= 0) continue;

            await fetchItems([componentId]);
            const component = itemCache.get(componentId);
            if (!component) continue;

            if (component.type === 'raw_material' || component.type === 'packaging') {
                accumulateLeafNeed(componentId, componentQty);
                continue;
            }

            await fetchProfiles([componentId]);
            const profile = profileCache.get(componentId);

            if (profile?.is_produced) {
                await explodeItemDemand(componentId, componentQty, nextTrail, null);
            }
        }
    };

    // Calculate forecast by exploding BOM from each root work order.
    for (const wo of rootWorkOrders) {
        const planned = Number(wo.planned_qty || 0);
        const produced = Number(wo.produced_qty || 0);
        const remaining = Math.max(0, planned - produced);
        if (remaining <= 0) continue;

        await explodeItemDemand(wo.item_id, remaining, new Set<string>(), wo.bom_id);
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

    const profileLookup = new Map<string, InventoryProfile>();
    (invProfiles || []).forEach((p) => profileLookup.set(p.item_id, p as InventoryProfile));

    // Calculate Stock Balance Manually: SUM(qty_in) - SUM(qty_out)
    const { data: movements, error: movError } = await supabase
        .from('inventory_movements')
        .select('item_id, qty_in, qty_out')
        .eq('company_id', companyId)
        .in('item_id', validComponentIds);

    if (movError) throw movError;

    const stockMap = new Map<string, number>();
    (movements || []).forEach((m) => {
        const movement = m as StockMovement;
        const current = stockMap.get(m.item_id) || 0;
        const balance = (movement.qty_in || 0) - (movement.qty_out || 0);
        stockMap.set(movement.item_id, current + balance);
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
