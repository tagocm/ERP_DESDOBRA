
import { SupabaseClient } from '@supabase/supabase-js';

export interface CreateDeliveryParams {
    salesDocumentId: string;
    routeId?: string;
    userId: string;
    companyId: string;
}

export interface UpdateDeliveryItemParams {
    itemId: string; // The delivery_item id
    qtyLoaded?: number;
    qtyDelivered?: number;
    qtyReturned?: number;
}

/**
 * Creates a new Delivery for a specific Sales Document.
 * Logic:
 * 1. Checks next sequential number for this order.
 * 2. Fetches current Sales Document Items.
 * 3. Creates 'deliveries' record.
 * 4. Creates 'delivery_items' records based on current order items (snapshot).
 */
export async function createDeliveryFromSalesOrder(
    supabase: SupabaseClient,
    params: CreateDeliveryParams
) {
    const { salesDocumentId, routeId, userId, companyId } = params;

    // 1. Get next number
    // We can do a count of existing deliveries for this doc + 1
    const { count, error: countError } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('sales_document_id', salesDocumentId);

    if (countError) throw countError;
    const nextNumber = (count || 0) + 1;

    // 2. Fetch Order Items
    const { data: orderItems, error: itemsError } = await supabase
        .from('sales_document_items')
        .select('id, quantity')
        .eq('document_id', salesDocumentId);

    if (itemsError) throw itemsError;
    if (!orderItems || orderItems.length === 0) {
        throw new Error("Sales Document has no items.");
    }

    // 2.5 Fetch existing deliveries to calculate pending balance
    const itemIds = orderItems.map(i => i.id);
    const { data: previousDeliveryItems } = await supabase
        .from('delivery_items')
        .select(`
            sales_document_item_id, 
            qty_delivered, 
            qty_planned,
            delivery:deliveries!inner(status)
        `)
        .in('sales_document_item_id', itemIds)
        .neq('delivery.status', 'cancelled');

    // itemsMap: itemId -> committedQty
    const committedMap = new Map<string, number>();
    if (previousDeliveryItems) {
        previousDeliveryItems.forEach((pItem: any) => {
            const status = pItem.delivery?.status;
            let committed = 0;
            // If delivered/completed, use ACTUAL delivered qty
            // If in_route/draft, use PLANNED qty (reservation)
            if (['delivered', 'returned_partial', 'returned_total', 'completed'].includes(status)) {
                committed = Number(pItem.qty_delivered || 0);
            } else {
                committed = Number(pItem.qty_planned || 0);
            }
            const current = committedMap.get(pItem.sales_document_item_id) || 0;
            committedMap.set(pItem.sales_document_item_id, current + committed);
        });
    }

    // 3. Create Delivery Header
    const { data: delivery, error: insertError } = await supabase
        .from('deliveries')
        .insert({
            company_id: companyId,
            sales_document_id: salesDocumentId,
            number: nextNumber,
            status: 'draft',
            route_id: routeId || null,
            created_by: userId
        })
        .select()
        .single();

    if (insertError) throw insertError;

    // 4. Create Delivery Items (Snapshot with Balance)
    const deliveryItemsPayload = orderItems.map(item => {
        const committed = committedMap.get(item.id) || 0;
        const balance = Math.max(0, item.quantity - committed);

        return {
            company_id: companyId,
            delivery_id: delivery.id,
            sales_document_item_id: item.id,
            qty_planned: balance, // Use balance instead of total
            qty_loaded: 0,
            qty_delivered: 0,
            qty_returned: 0
        };
    });

    const { error: itemsInsertError } = await supabase
        .from('delivery_items')
        .insert(deliveryItemsPayload);

    if (itemsInsertError) {
        // Cleanup header if items fail? Or let transaction handle it if RPC?
        // Since we are not in a single RPC transaction here, we might leave a header without items. 
        // For MVP, we throw. Ideally wrapping in RPC is safer.
        console.error("Failed to insert delivery items", itemsInsertError);
        throw itemsInsertError;
    }

    return delivery;
}


/**
 * Updates quantities for specific delivery items.
 */
export async function updateDeliveryItemQuantities(
    supabase: SupabaseClient,
    deliveryId: string,
    items: UpdateDeliveryItemParams[]
) {
    for (const item of items) {
        const payload: any = {};
        if (item.qtyLoaded !== undefined) payload.qty_loaded = item.qtyLoaded;
        if (item.qtyDelivered !== undefined) payload.qty_delivered = item.qtyDelivered;
        if (item.qtyReturned !== undefined) payload.qty_returned = item.qtyReturned;

        payload.updated_at = new Date().toISOString();

        const { error } = await supabase
            .from('delivery_items')
            .update(payload)
            .eq('id', item.itemId)
            .eq('delivery_id', deliveryId); // Security check

        if (error) throw error;
    }
}


/**
 * Sets the status of a delivery.
 */
export async function setDeliveryStatus(
    supabase: SupabaseClient,
    deliveryId: string,
    status: string // typed as text but matched against enum DB side
) {
    // Basic validation could go here
    const { error } = await supabase
        .from('deliveries')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', deliveryId);

    if (error) throw error;
}
