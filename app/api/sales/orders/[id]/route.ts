import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { normalizeLogisticsStatus, translateLogisticsStatusPt } from '@/lib/constants/status';
import { logger } from '@/lib/logger';

export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orderId = params.id;

        // Debug: Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(orderId)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        // 1. Fetch the order to validate
        const { data: order, error: fetchError } = await supabase
            .from('sales_documents')
            .select('id, document_number, status_logistic, doc_type')
            .eq('id', orderId)
            .maybeSingle();

        if (fetchError) {
            logger.error('[sales/orders/delete] Error fetching order', {
                orderId,
                code: fetchError.code,
                message: fetchError.message
            });
            return NextResponse.json({ error: 'Erro ao buscar pedido' }, { status: 500 });
        }

        if (!order) {
            return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
        }

        // 2. Validate business rules - cannot delete if in certain states
        const blockedStatuses = ['in_route', 'delivered', 'not_delivered'];
        const normalizedStatus = normalizeLogisticsStatus(order.status_logistic) || order.status_logistic;
        if (blockedStatuses.includes(normalizedStatus)) {
            const statusLabel = translateLogisticsStatusPt(order.status_logistic).toUpperCase();
            return NextResponse.json({
                error: `Pedido não pode ser excluído porque já está ${statusLabel}.`
            }, { status: 400 });
        }

        // 3. Check if order is linked to a route
        const { data: routeLinks, error: routeError } = await supabase
            .from('delivery_route_orders')
            .select('id, route_id, route:delivery_routes(id, name, scheduled_date, status)')
            .eq('sales_document_id', orderId);

        if (routeError) {
            logger.warn('[sales/orders/delete] Failed checking route links (non-blocking)', {
                orderId,
                code: routeError.code,
                message: routeError.message
            });
        }

        let routeToUpdate: any = null;
        if (routeLinks && routeLinks.length > 0) {
            routeToUpdate = routeLinks[0].route;
        }

        // 4. Start transaction-like operations
        // Delete route links first
        if (routeLinks && routeLinks.length > 0) {
            const { error: unlinkError } = await supabase
                .from('delivery_route_orders')
                .delete()
                .eq('sales_document_id', orderId);

            if (unlinkError) {
                logger.error('[sales/orders/delete] Failed unlinking from route', {
                    orderId,
                    code: unlinkError.code,
                    message: unlinkError.message
                });
                return NextResponse.json({
                    error: 'Erro ao desvincular pedido da rota.'
                }, { status: 500 });
            }
        }

        // 5. Delete order items
        const { error: itemsError } = await supabase
            .from('sales_document_items')
            .delete()
            .eq('document_id', orderId);

        if (itemsError) {
            logger.error('[sales/orders/delete] Failed deleting order items', {
                orderId,
                code: itemsError.code,
                message: itemsError.message
            });
            return NextResponse.json({
                error: 'Erro ao excluir itens do pedido.'
            }, { status: 500 });
        }

        // 6. Delete the order itself
        const { error: deleteError } = await supabase
            .from('sales_documents')
            .delete()
            .eq('id', orderId);

        if (deleteError) {
            logger.error('[sales/orders/delete] Failed deleting order', {
                orderId,
                code: deleteError.code,
                message: deleteError.message
            });
            return NextResponse.json({
                error: 'Erro ao excluir pedido.'
            }, { status: 500 });
        }

        // 7. Update route if necessary
        if (routeToUpdate) {
            // Check how many orders remain in the route
            const { data: remainingOrders, error: countError } = await supabase
                .from('delivery_route_orders')
                .select('id')
                .eq('route_id', routeToUpdate.id);

            if (!countError) {
                const remainingCount = remainingOrders?.length || 0;

                // If route is now empty, unschedule it
                if (remainingCount === 0) {
                    await supabase
                        .from('delivery_routes')
                        .update({
                            scheduled_date: null,
                            status: 'planned'
                        })
                        .eq('id', routeToUpdate.id);
                }
            }
        }

        // 8. Log the deletion (simple audit trail) - optional, don't fail if table doesn't exist
        try {
            await supabase
                .from('sales_document_history')
                .insert({
                    document_id: orderId,
                    user_id: session.user.id,
                    event_type: 'DELETED',
                    description: `Pedido #${order.document_number} excluído permanentemente`,
                    metadata: {
                        deleted_at: new Date().toISOString(),
                        was_in_route: !!routeToUpdate,
                        route_name: routeToUpdate?.name
                    }
                });
        } catch (logError) {
            const message = logError instanceof Error ? logError.message : String(logError);
            logger.warn('[sales/orders/delete] Failed to write audit log (non-blocking)', { orderId, message });
        }

        return NextResponse.json({
            success: true,
            message: 'Pedido excluído com sucesso',
            routeUpdated: !!routeToUpdate
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[sales/orders/delete] Error', { message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Erro ao excluir pedido' : message },
            { status: 500 }
        );
    }
}
