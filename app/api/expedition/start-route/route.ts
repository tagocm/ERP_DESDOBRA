
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { createDeliveryFromSalesOrder, updateDeliveryItemQuantities, setDeliveryStatus } from '@/lib/services/deliveries';
import { normalizeLoadingStatus } from '@/lib/constants/status';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { routeId } = await request.json();

        if (!routeId) {
            return NextResponse.json({ error: 'Route ID required' }, { status: 400 });
        }

        // 1. Fetch Route Orders with relevant info
        const { data: routeOrders, error: fetchError } = await supabase
            .from('delivery_route_orders')
            .select(`
                id, loading_status, partial_payload, sales_document_id,
                sales_order:sales_documents(*)
            `)
            .eq('route_id', routeId);

        if (fetchError) throw fetchError;

        // 2. Fetch Route Info (for notes)
        const { data: route } = await supabase
            .from('delivery_routes')
            .select('name, route_date')
            .eq('id', routeId)
            .single();
        const routeName = route?.name || 'Rota desconhecida';

        // 3. Process each order
        const ordersToUpdateStatus = [];

        for (const ro of routeOrders) {
            const originalOrder = ro.sales_order as any;
            if (!originalOrder) continue;

            const companyId = originalOrder.company_id;
            const loadingStatus = normalizeLoadingStatus(ro.loading_status) || 'pending';

            const now = new Date();
            const noteTimestamp = `[${now.toLocaleDateString()}]`;

            // Case 1: Not Loaded or Pending (Ignored/Returned to backlog)
            if (loadingStatus === 'not_loaded' || loadingStatus === 'pending') {
                if (loadingStatus === 'not_loaded') {
                    const { reason, text_other } = ro.partial_payload || {};
                    const note = `\n${noteTimestamp} NÃO CARREGADO na rota ${routeName}. Motivo: ${reason || 'Não informado'}. ${text_other || ''}. Pedido mantido no BACKLOG.`;

                    await supabase.from('sales_documents')
                        .update({
                            internal_notes: (originalOrder.internal_notes || '') + note,
                            loading_checked: false,
                            status_logistic: 'pending'
                        })
                        .eq('id', originalOrder.id);
                }
                continue;
            }

            // Case 2: Loaded (Full) OR Partial
            if (loadingStatus === 'loaded' || loadingStatus === 'partial') {
                ordersToUpdateStatus.push(originalOrder.id);

                // A. Find or Create Delivery
                let deliveryId = null;
                const { data: existingDeliveries } = await supabase
                    .from('deliveries')
                    .select('id, status')
                    .eq('sales_document_id', originalOrder.id)
                    .eq('route_id', routeId)
                    .neq('status', 'cancelled')
                    .limit(1);

                if (existingDeliveries && existingDeliveries.length > 0) {
                    deliveryId = existingDeliveries[0].id;
                } else {
                    const newDelivery = await createDeliveryFromSalesOrder(supabase, {
                        salesDocumentId: originalOrder.id,
                        routeId: routeId,
                        userId: session.user.id,
                        companyId: companyId
                    });
                    deliveryId = newDelivery.id;
                }

                // B. Update Items (Quantities)
                const { data: deliveryItems } = await supabase
                    .from('delivery_items')
                    .select('id, sales_document_item_id, qty_planned')
                    .eq('delivery_id', deliveryId);

                if (deliveryItems && deliveryItems.length > 0) {
                    const updates = [];

                    if (loadingStatus === 'partial') {
                        // Partial: Use quantities from payload
                        const payloadItems = ro.partial_payload?.items || [];
                        // Map: orderItemId -> qtyLoaded
                        const qtyMap = new Map();
                        payloadItems.forEach((pi: any) => qtyMap.set(pi.orderItemId, Number(pi.qtyLoaded)));

                        for (const dItem of deliveryItems) {
                            const loadedQty = qtyMap.has(dItem.sales_document_item_id)
                                ? qtyMap.get(dItem.sales_document_item_id)
                                : 0; // If not in payload, assume 0? Or full? Partial modal includes all items usually.

                            updates.push({
                                itemId: dItem.id,
                                qtyLoaded: Number(loadedQty)
                            });
                        }

                        // Add note for partial
                        const { reasonName, note: partialNote } = ro.partial_payload || {};
                        const note = `\n${noteTimestamp} CARREGAMENTO PARCIAL na rota ${routeName}. Motivo: ${reasonName || 'Outro'}. ${partialNote || ''}`;

                        await supabase.from('sales_documents')
                            .update({ internal_notes: (originalOrder.internal_notes || '') + note })
                            .eq('id', originalOrder.id);

                    } else {
                        // Full Loaded: Use planned quantities
                        for (const dItem of deliveryItems) {
                            updates.push({
                                itemId: dItem.id,
                                qtyLoaded: Number(dItem.qty_planned)
                            });
                        }
                    }

                    await updateDeliveryItemQuantities(supabase, deliveryId, updates);
                }

                // C. Set Delivery Status
                await setDeliveryStatus(supabase, deliveryId, 'in_route');

                // D. Update Route Order Marker
                await supabase.from('delivery_route_orders')
                    .update({
                        // Persist partial status if partial, else loaded
                        loading_status: loadingStatus,
                        // Enhance payload with delivery_id
                        partial_payload: {
                            ...(ro.partial_payload || {}),
                            mode: 'deliveries_model',
                            delivery_id: deliveryId
                        }
                    })
                    .eq('id', ro.id);

                // E. Update Sales Document
                await supabase.from('sales_documents')
                    .update({
                        status_logistic: 'in_route',
                        loading_checked: true,
                        loading_checked_at: new Date().toISOString(),
                        loading_checked_by: session.user.id
                    })
                    .eq('id', originalOrder.id);
            }
        }

        // 4. Update Status of all processed orders to 'in_route' (Bulk safety check)
        if (ordersToUpdateStatus.length > 0) {
            const { error: updateError } = await supabase
                .from('sales_documents')
                .update({ status_logistic: 'in_route' })
                .in('id', ordersToUpdateStatus);

            if (updateError) throw updateError;
        }

        // 5. Update Route Status
        const newRouteStatus = ordersToUpdateStatus.length === 0 ? 'cancelled' : 'in_route';

        await supabase
            .from('delivery_routes')
            .update({ status: newRouteStatus })
            .eq('id', routeId);

        // 6. Log Route Event
        const summaryLog = routeOrders.map(ro => ({
            order_id: (ro.sales_order as any)?.id,
            document_number: (ro.sales_order as any)?.document_number,
            status: ro.loading_status,
        }));

        await supabase.from('route_event_logs').insert({
            route_id: routeId,
            event_code: 'ROUTE_STARTED',
            payload: {
                started_at: new Date().toISOString(),
                orders_count: routeOrders.length,
                user_id: session.user.id,
                summary: summaryLog
            },
            created_by_user_id: session.user.id
        });

        // 7. Deduct Stock (Inventory Movement)
        const { error: stockError } = await supabase.rpc('deduct_stock_from_route', {
            p_route_id: routeId,
            p_user_id: session.user.id
        });

        if (stockError) {
            const stockMessage = typeof stockError?.message === 'string' ? stockError.message : 'Unknown error';
            const stockCode = typeof stockError?.code === 'string' ? stockError.code : undefined;
            logger.error('[expedition/start-route] Stock deduction failed', {
                routeId,
                code: stockCode,
                message: stockMessage
            });
            // Log error but don't fail the request since route is already started
            await supabase.from('route_event_logs').insert({
                route_id: routeId,
                event_code: 'STOCK_ERROR',
                payload: { code: stockCode, message: stockMessage },
                created_by_user_id: session.user.id
            });
        }

        return NextResponse.json({ success: true, processed: ordersToUpdateStatus.length });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[expedition/start-route] Error', { message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Failed to start route' : message },
            { status: 500 }
        );
    }
}
