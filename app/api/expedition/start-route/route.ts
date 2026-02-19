
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { createDeliveryFromSalesOrder, updateDeliveryItemQuantities, setDeliveryStatus } from '@/lib/services/deliveries';
import { normalizeLoadingStatus } from '@/lib/constants/status';
import { logger } from '@/lib/logger';
import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.join(process.cwd(), 'debug_log.txt');

function logToFile(message: string, data?: any) {
    try {
        const timestamp = new Date().toISOString();
        const extra = data ? `\nDATA: ${JSON.stringify(data, null, 2)}` : '';
        const entry = `[${timestamp}] ${message}${extra}\n`;
        fs.appendFileSync(LOG_FILE, entry);
    } catch (e) {
        // ignore
    }
}

export async function POST(request: Request) {
    logToFile("[API] /api/expedition/start-route called (Retry with RPC)");
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

        if (fetchError) {
            throw fetchError;
        }

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

            // Case 1: Not Loaded or Pending
            if (loadingStatus === 'not_loaded' || loadingStatus === 'pending') {
                if (loadingStatus === 'not_loaded') {
                    // ... logic
                    const { reason, text_other } = ro.partial_payload || {};
                    const note = `\n${noteTimestamp} NÃO CARREGADO na rota ${routeName}. Motivo: ${reason || 'Não informado'}. ${text_other || ''}. Pedido mantido no BACKLOG.`;

                    await supabase.from('sales_documents')
                        .update({
                            internal_notes: (originalOrder.internal_notes || '') + note,
                            loading_checked: false,
                            // status_logistic: 'pending' -> Moved to RPC
                        })
                        .eq('id', originalOrder.id);

                    // Status update intentionally skipped here due enum/RPC schema drift in some environments.
                }
                continue;
            }

            // Case 2: Loaded (Full) OR Partial
            if (loadingStatus === 'loaded' || loadingStatus === 'partial') {
                try {
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

                    // B. Update Items
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
                                    : 0;

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
                            // Full Loaded
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
                            loading_status: loadingStatus,
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
                            loading_checked: true,
                            loading_checked_at: new Date().toISOString(),
                            loading_checked_by: session.user.id
                        })
                        .eq('id', originalOrder.id);
                } catch (orderProcessErr: any) {
                    const orderMessage = orderProcessErr?.message || '';
                    const isLegacyCastError =
                        orderProcessErr?.code === '42804'
                        || orderMessage.includes('status_logistic')
                        || orderMessage.includes('expression is of type text');

                    if (!isLegacyCastError) throw orderProcessErr;

                    logger.error('[expedition/start-route] delivery flow blocked due legacy cast incompatibility', {
                        routeId,
                        orderId: originalOrder.id,
                        message: orderMessage,
                        code: orderProcessErr?.code
                    });
                    logToFile('[ERROR] Delivery flow blocked due legacy cast incompatibility', {
                        routeId,
                        orderId: originalOrder.id,
                        message: orderMessage,
                        code: orderProcessErr?.code
                    });
                    throw new Error('Incompatibilidade de status logístico no banco. A rota não pode iniciar sem delivery/baixa de estoque.');
                }
            }
        }

        // 4. Bulk Update Status REMOVED (Redundant and prone to error without RPC)

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

        // 7. Deduct Stock
        let usedLegacyStockRpc = false;
        let { error: stockError } = await supabase.rpc('deduct_stock_from_route', {
            p_route_id: routeId,
            p_user_id: session.user.id
        });

        if (stockError) {
            const initialMessage = typeof stockError?.message === 'string' ? stockError.message : '';
            const isLegacySignatureMismatch =
                initialMessage.includes('deduct_stock_from_route') &&
                (initialMessage.includes('function') || initialMessage.includes('Could not find the function'));

            if (isLegacySignatureMismatch) {
                usedLegacyStockRpc = true;
                const fallback = await supabase.rpc('deduct_stock_from_route', {
                    p_route_id: routeId
                });
                stockError = fallback.error;
            }
        }

        if (stockError) {
            const stockMessage = typeof stockError?.message === 'string' ? stockError.message : 'Unknown error';
            const stockCode = typeof stockError?.code === 'string' ? stockError.code : undefined;
            logger.error('[expedition/start-route] Stock deduction failed', {
                routeId,
                code: stockCode,
                message: stockMessage
            });
            await supabase.from('route_event_logs').insert({
                route_id: routeId,
                event_code: 'STOCK_ERROR',
                payload: { code: stockCode, message: stockMessage },
                created_by_user_id: session.user.id
            });
            logToFile('[ERROR] Stock deduction failed', {
                routeId,
                code: stockCode,
                message: stockMessage
            });
            throw new Error(`Rota iniciada, mas a baixa de estoque falhou: ${stockMessage}`);
        }

        if (usedLegacyStockRpc) {
            await supabase.from('route_event_logs').insert({
                route_id: routeId,
                event_code: 'STOCK_RPC_FALLBACK',
                payload: {
                    message: 'deduct_stock_from_route executada com assinatura legada (1 parâmetro).'
                },
                created_by_user_id: session.user.id
            });
        }

        return NextResponse.json({ success: true, processed: ordersToUpdateStatus.length });

    } catch (error: any) {
        const errorData = {
            message: error?.message,
            stack: error?.stack,
            ...error
        };
        logToFile("FINAL CATCH ERROR", errorData);

        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[expedition/start-route] Error', { message });

        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Failed to start route' : message },
            { status: 500 }
        );
    }
}
