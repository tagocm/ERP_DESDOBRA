
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { setDeliveryStatus, updateDeliveryItemQuantities } from '@/lib/services/deliveries';
import { logger } from '@/lib/logger';
import { isRouteOrderEligibleForReturn } from '@/lib/logistics/flow-rules';

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    try {
        const { routeId } = await request.json();

        if (!routeId) {
            return NextResponse.json({ error: 'Missing routeId' }, { status: 400 });
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch Route Orders with their Sales Order and Staging Data
        const { data: routeOrders, error: fetchError } = await supabase
            .from('delivery_route_orders')
            .select(`
                id, loading_status, return_outcome_type, return_payload, sales_document_id,
                sales_order:sales_documents(*)
            `)
            .eq('route_id', routeId);

        if (fetchError) throw fetchError;
        if (!routeOrders || routeOrders.length === 0) throw new Error('Rota sem pedidos.');

        const scopedRouteOrders = routeOrders.filter((ro: any) =>
            isRouteOrderEligibleForReturn(ro.loading_status, ro.sales_order?.status_logistic)
        );

        if (scopedRouteOrders.length === 0) {
            return NextResponse.json(
                { error: 'Nenhum pedido carregado/em rota para finalizar retorno.' },
                { status: 400 }
            );
        }

        // Validate all have outcomes
        const pending = scopedRouteOrders.filter(ro => !ro.return_outcome_type);
        if (pending.length > 0) {
            return NextResponse.json({ error: 'Todos os pedidos devem ter um resultado definido.' }, { status: 400 });
        }

        const { data: route } = await supabase.from('delivery_routes').select('name, route_date').eq('id', routeId).single();
        const routeName = route?.name || 'Rota';

        const nowIso = new Date().toISOString();
        const baseDate = new Date().toLocaleDateString();
        const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('auth_user_id')
            .eq('auth_user_id', user.id)
            .maybeSingle();
        const movementCreatedBy = userProfile?.auth_user_id || null;

        // 2. Process Outcomes
        for (const ro of scopedRouteOrders) {
            let outcome = ro.return_outcome_type;
            if (outcome === 'ENTREGUE') outcome = 'delivered';
            if (outcome === 'DEVOLVIDO_PARCIAL') outcome = 'partial';
            if (outcome === 'NAO_ENTREGUE') outcome = 'not_delivered';

            const payload = ro.return_payload || {};
            const actionFlags = payload.actionFlags || {};
            const order = ro.sales_order as any;
            if (!order) continue;
            const shouldCreateReturnMovement =
                actionFlags.create_devolution !== false &&
                actionFlags.generate_return_movement !== false;

            const toBaseQty = (item: any, qtyDisplay: number) => {
                if (item?.qty_base !== null && item?.qty_base !== undefined && Number(item.quantity) > 0) {
                    return (Number(item.qty_base) / Number(item.quantity)) * qtyDisplay;
                }
                return qtyDisplay;
            };

            const createReturnMovement = async (
                item: any,
                qtyDisplay: number,
                reasonText: string,
                referenceType: string,
                referenceId: string
            ) => {
                if (!shouldCreateReturnMovement || qtyDisplay <= 0) return;

                const qtyBase = toBaseQty(item, qtyDisplay);
                if (!Number.isFinite(qtyBase) || qtyBase <= 0) return;

                // Idempotency: avoid duplicate return movement for the same reference.
                const { data: existingMovement, error: findMovementError } = await supabase
                    .from('inventory_movements')
                    .select('id')
                    .eq('company_id', order.company_id)
                    .eq('movement_type', 'ENTRADA')
                    .eq('reference_type', referenceType)
                    .eq('reference_id', referenceId)
                    .eq('reason', 'customer_return')
                    .maybeSingle();
                if (findMovementError) {
                    throw new Error(`Falha ao verificar movimentação existente: ${findMovementError.message}`);
                }

                if (existingMovement?.id) return;

                const { error: insertMovementError } = await supabase.from('inventory_movements').insert({
                    company_id: order.company_id,
                    item_id: item.item_id,
                    movement_type: 'ENTRADA',
                    qty_base: qtyBase,
                    reference_type: referenceType,
                    reference_id: referenceId,
                    source_ref: `#${order.document_number} (Retorno)`,
                    notes: `Retorno de Rota: ${reasonText}`,
                    created_by: movementCreatedBy,
                    reason: 'customer_return',
                    qty_in: qtyBase,
                    qty_out: 0
                });
                if (insertMovementError) {
                    throw new Error(`Falha ao inserir devolução no estoque: ${insertMovementError.message}`);
                }
            };

            await supabase.from('order_occurrence_logs').insert({
                order_id: order.id,
                route_id: routeId,
                type_code: outcome === 'delivered' ? 'RETORNO_ENTREGUE' : (outcome === 'partial' ? 'RETORNO_ENTREGA_PARCIAL' : 'RETORNO_NAO_ENTREGUE'),
                reason_label_snapshot: payload.reason,
                note: payload.notes,
                actions_applied: payload.actionFlags || {},
                created_by_user_id: user.id
            });

            // --- DELIVERIES MODEL UPDATE START ---
            // Attempt to find associated delivery to update it
            const { data: existingDeliveries } = await supabase
                .from('deliveries')
                .select('id, status')
                .eq('sales_document_id', order.id)
                .eq('route_id', routeId)
                .neq('status', 'cancelled')
                .limit(1);

            if (existingDeliveries && existingDeliveries.length > 0) {
                const deliveryId = existingDeliveries[0].id;
                const { data: deliveryItems } = await supabase
                    .from('delivery_items')
                    .select('id, sales_document_item_id, qty_loaded')
                    .eq('delivery_id', deliveryId);

                if (outcome === 'delivered') {
                    // All items delivered
                    await setDeliveryStatus(supabase, deliveryId, 'delivered');
                    if (deliveryItems) {
                        const updates = deliveryItems.map(di => ({
                            itemId: di.id,
                            qtyDelivered: Number(di.qty_loaded || 0),
                            qtyReturned: 0
                        }));
                        await updateDeliveryItemQuantities(supabase, deliveryId, updates);
                    }
                } else if (outcome === 'not_delivered') {
                    // All items returned
                    await setDeliveryStatus(supabase, deliveryId, 'returned_total');
                    if (deliveryItems) {
                        const updates = deliveryItems.map(di => ({
                            itemId: di.id,
                            qtyDelivered: 0,
                            qtyReturned: Number(di.qty_loaded || 0)
                        }));
                        await updateDeliveryItemQuantities(supabase, deliveryId, updates);

                        // CREATE INVENTORY MOVEMENT (SAÍDA REVERSAL aka ENTRADA)
                        // Use originalItems to lookup item_id
                        const { data: originalItems } = await supabase
                            .from('sales_document_items')
                            .select('id, item_id, quantity, qty_base')
                            .eq('document_id', order.id);

                        const itemMap = new Map(originalItems?.map(i => [i.id, i]) || []);

                        for (const di of deliveryItems) {
                            const qtyReturned = Number(di.qty_loaded || 0);
                            if (qtyReturned > 0) {
                                const originalItem = itemMap.get(di.sales_document_item_id);
                                if (originalItem) {
                                    await createReturnMovement(
                                        originalItem,
                                        qtyReturned,
                                        payload.reason || 'Devolução Total',
                                        'delivery_item',
                                        di.id
                                    );
                                }
                            }
                        }
                    }
                } else if (outcome === 'partial') {
                    logger.debug('[expedition/finish-return] Processing partial return', {
                        orderId: order.id,
                        routeId,
                        deliveredItemsCount: Array.isArray(payload.deliveredItems) ? payload.deliveredItems.length : 0
                    });

                    await setDeliveryStatus(supabase, deliveryId, 'returned_partial');

                    const deliveredMap = new Map();
                    if (payload.deliveredItems && Array.isArray(payload.deliveredItems)) {
                        payload.deliveredItems.forEach((i: any) => deliveredMap.set(i.itemId, i.deliveredQty));
                    }

                    // Pre-fetch original items for item_id lookup
                    const { data: originalItems } = await supabase
                        .from('sales_document_items')
                        .select('id, item_id, quantity, qty_base')
                        .eq('document_id', order.id);

                    const itemMap = new Map(originalItems?.map(i => [i.id, i]) || []);

                    if (deliveryItems) {
                        const updates = [];
                        let returnedItemsCount = 0;
                        for (const di of deliveryItems) {
                            const deliveredQty = deliveredMap.has(di.sales_document_item_id)
                                ? Number(deliveredMap.get(di.sales_document_item_id))
                                : 0;

                            const loaded = Number(di.qty_loaded || 0);
                            const returned = Math.max(0, loaded - deliveredQty);
                            if (returned > 0) returnedItemsCount++;

                            updates.push({
                                itemId: di.id,
                                qtyDelivered: deliveredQty,
                                qtyReturned: returned
                            });

                            // CREATE INVENTORY MOVEMENT (SAÍDA REVERSAL aka ENTRADA)
                            if (returned > 0) {
                                const originalItem = itemMap.get(di.sales_document_item_id);
                                if (originalItem) {
                                    await createReturnMovement(
                                        originalItem,
                                        returned,
                                        payload.reason || 'Devolução Parcial',
                                        'delivery_item',
                                        di.id
                                    );
                                }
                            }
                        }
                        logger.debug('[expedition/finish-return] Updating delivery item quantities', {
                            deliveryId,
                            updatesCount: updates.length,
                            returnedItemsCount
                        });
                        await updateDeliveryItemQuantities(supabase, deliveryId, updates);
                    }
                }
            } else if (shouldCreateReturnMovement && (outcome === 'not_delivered' || outcome === 'partial')) {
                // Fallback for legacy/inconsistent rows where delivery record was not found.
                // Derive returned quantity from route payload + order items.
                const { data: originalItems } = await supabase
                    .from('sales_document_items')
                    .select('id, item_id, quantity, qty_base')
                    .eq('document_id', order.id);

                const items = originalItems || [];
                if (items.length > 0) {
                    const loadedMap = new Map<string, number>();
                    const deliveredMap = new Map<string, number>();

                    if (Array.isArray(payload.items)) {
                        payload.items.forEach((pi: any) => {
                            const key = String(pi.orderItemId || pi.itemId || '');
                            if (!key) return;
                            loadedMap.set(key, Number(pi.qtyLoaded ?? pi.qty_loaded ?? 0));
                        });
                    }
                    if (Array.isArray(payload.deliveredItems)) {
                        payload.deliveredItems.forEach((di: any) => {
                            const key = String(di.itemId || '');
                            if (!key) return;
                            deliveredMap.set(key, Number(di.deliveredQty ?? 0));
                        });
                    }

                    for (const item of items as any[]) {
                        const itemId = String(item.id);
                        const fallbackLoaded = Number(item.quantity || 0);
                        const loadedQty = loadedMap.has(itemId) ? Number(loadedMap.get(itemId) || 0) : fallbackLoaded;
                        const deliveredQty = outcome === 'partial'
                            ? Number(deliveredMap.get(itemId) || 0)
                            : 0;
                        const returnedQty = outcome === 'partial'
                            ? Math.max(0, loadedQty - deliveredQty)
                            : Math.max(0, loadedQty);

                        if (returnedQty > 0) {
                            await createReturnMovement(
                                item,
                                returnedQty,
                                payload.reason || (outcome === 'partial' ? 'Devolução Parcial (Fallback)' : 'Devolução Total (Fallback)'),
                                'pedido_item_return',
                                itemId
                            );
                        }
                    }
                }
            }
            // --- DELIVERIES MODEL UPDATE END ---


            // === A) ENTREGUE (delivered) ===
            if (outcome === 'delivered') {
                // ... (Logic for converting status to delivered) ...
                // Re-fetch logic simplified for status update
                const { data: orderDeliveries } = await supabase
                    .from('deliveries')
                    .select('id')
                    .eq('sales_document_id', order.id);
                const deliveryIds = orderDeliveries?.map(d => d.id) || [];
                const { data: allDeliveryItems } = await supabase
                    .from('delivery_items')
                    .select('sales_document_item_id, qty_delivered')
                    .in('delivery_id', deliveryIds);
                const totalDeliveredMap = new Map();
                if (allDeliveryItems) {
                    allDeliveryItems.forEach((di: any) => {
                        const current = totalDeliveredMap.get(di.sales_document_item_id) || 0;
                        totalDeliveredMap.set(di.sales_document_item_id, current + (di.qty_delivered || 0));
                    });
                }
                const { data: originalItems } = await supabase.from('sales_document_items').select('*').eq('document_id', order.id);

                let isFullyDelivered = true;
                if (originalItems) {
                    for (const item of originalItems) {
                        const totalDelivered = totalDeliveredMap.get(item.id) || 0;
                        const pendingQty = Math.max(0, Number(item.quantity) - totalDelivered);
                        if (pendingQty > 0) isFullyDelivered = false;
                    }
                }

                const finalStatus = isFullyDelivered ? 'delivered' : 'partial';
                const note = `[${baseDate}] ${isFullyDelivered ? 'ENTREGUE' : 'ENTREGA PARCIAL'} na rota ${routeName}.`;

                await supabase.from('sales_documents')
                    .update({
                        status_logistic: finalStatus,
                        internal_notes: (order.internal_notes || '') + '\n' + note,
                        updated_at: nowIso,
                        loading_checked: finalStatus === 'partial' ? false : order.loading_checked
                    })
                    .eq('id', order.id);

                // History log...
                await supabase.from('sales_document_history').insert({
                    document_id: order.id,
                    event_type: isFullyDelivered ? 'logistic_update' : 'logistic_partial',
                    description: 'Entrega processada (Resultado: Entregue)',
                    metadata: { routeId, outcome, user: user.id },
                    created_at: nowIso
                });

            }
            // === B) PARCIAL (partial) ===
            else if (outcome === 'partial') {
                // Update status only. DO NOT CREATE INVENTORY MOVEMENTS HERE AGAIN.
                // We already created them in the deliveryItems loop above.

                // Re-calculate status
                const { data: orderDeliveries } = await supabase.from('deliveries').select('id').eq('sales_document_id', order.id);
                const deliveryIds = orderDeliveries?.map(d => d.id) || [];
                const { data: allDeliveries } = await supabase.from('delivery_items').select('sales_document_item_id, qty_delivered').in('delivery_id', deliveryIds);

                const totalDeliveredMap = new Map();
                if (allDeliveries) {
                    allDeliveries.forEach((di: any) => {
                        const current = totalDeliveredMap.get(di.sales_document_item_id) || 0;
                        totalDeliveredMap.set(di.sales_document_item_id, current + (di.qty_delivered || 0));
                    });
                }
                const { data: originalItems } = await supabase.from('sales_document_items').select('*').eq('document_id', order.id);

                let hasAnyPending = false;
                if (originalItems) {
                    for (const item of originalItems) {
                        const totalDelivered = totalDeliveredMap.get(item.id) || 0;
                        const pendingQty = Math.max(0, Number(item.quantity) - totalDelivered);
                        if (pendingQty > 0) hasAnyPending = true;
                    }
                }

                const newStatusLogistic = hasAnyPending ? 'partial' : 'delivered';
                const note = `[${baseDate}] ENTREGA PARCIAL (Retorno da Rota) - Status: ${newStatusLogistic}`;

                await supabase.from('sales_documents')
                    .update({
                        status_logistic: newStatusLogistic,
                        internal_notes: (order.internal_notes || '') + '\n' + note,
                        updated_at: nowIso
                    })
                    .eq('id', order.id);

                await supabase.from('sales_document_history').insert({
                    document_id: order.id,
                    event_type: 'logistic_partial',
                    description: 'Retorno parcial processado',
                    metadata: { routeId, outcome, user: user.id },
                    created_at: nowIso
                });
            }
            // === C) NÃO ENTREGUE (not_delivered) ===
            else if (outcome === 'not_delivered') {
                // Removed redundant loop that was double-returning inventory. 
                // We rely on the delivery_items loop above to return exactly what was loaded.

                const noteContent = `[${baseDate}] TENTATIVA DE ENTREGA na rota ${routeName}: NÃO ENTREGUE. Motivo: ${payload.reason}. Obs: ${payload.notes || ''}.`;

                // Flag: register_attempt_note
                const shouldRegisterNote = actionFlags.register_attempt_note !== false; // Default true
                const newInternalNotes = shouldRegisterNote
                    ? (order.internal_notes || '') + '\n' + noteContent
                    : order.internal_notes;

                // Flag: return_to_sandbox_pending
                const shouldReturnToSandbox = actionFlags.return_to_sandbox_pending !== false; // Default true (safe)

                let newStatusLogistic = order.status_logistic;
                let newLoadingChecked = order.loading_checked;

                if (shouldReturnToSandbox) {
                    newStatusLogistic = 'pending';
                    newLoadingChecked = false; // Reset checking so it must be checked again
                } else {
                    newStatusLogistic = 'pending';
                    newLoadingChecked = false;
                }

                await supabase.from('sales_documents')
                    .update({
                        status_logistic: newStatusLogistic,
                        internal_notes: newInternalNotes,
                        loading_checked: newLoadingChecked,
                        updated_at: nowIso
                    })
                    .eq('id', order.id);

                await supabase.from('sales_document_history').insert({
                    document_id: order.id,
                    event_type: 'logistic_return',
                    description: 'Devolvido para Sandbox (Não Entregue)',
                    metadata: { routeId, outcome, user: user.id, actionFlags },
                    created_at: nowIso
                });
            }
        }

        // 3. Log Route Event
        const summaryLog = scopedRouteOrders.map(ro => ({
            order_id: (ro.sales_order as any)?.id,
            document_number: (ro.sales_order as any)?.document_number,
            outcome: ro.return_outcome_type, // 'delivered', 'partial', 'not_delivered'
            reason: ro.return_payload?.reason
        }));

        await supabase.from('route_event_logs').insert({
                route_id: routeId,
                event_code: 'ROUTE_FINISHED',
                payload: {
                    finished_at: nowIso,
                    orders_count: scopedRouteOrders.length,
                    user_id: user.id,
                    summary: summaryLog
                },
            created_by_user_id: user.id
        });

        // 4. Close Route
        const { error: routeError } = await supabase
            .from('delivery_routes')
            .update({ status: 'completed' })
            .eq('id', routeId);

        if (routeError) throw routeError;

        return NextResponse.json({ success: true });

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('[expedition/finish-return] Error', { message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Erro ao finalizar retorno' : message },
            { status: 500 }
        );
    }
}
