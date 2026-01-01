import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

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

        console.log('API: Attempting to delete order:', orderId);

        // Debug: Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(orderId)) {
            console.error('API: Invalid UUID format:', orderId);
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        // 1. Fetch the order to validate
        const { data: order, error: fetchError } = await supabase
            .from('sales_documents')
            .select('id, document_number, status_logistic, doc_type')
            .eq('id', orderId)
            .maybeSingle();

        console.log('API: Fetch result:', { order, error: fetchError });

        if (fetchError) {
            console.error('API: Database error fetching order:', fetchError);
            return NextResponse.json({ error: 'Erro ao buscar pedido', details: fetchError.message }, { status: 500 });
        }

        if (!order) {
            console.error('API: Order not found (returned null). Possible RLS issue or wrong ID.');
            return NextResponse.json({
                error: 'Pedido não encontrado',
                details: 'O pedido não existe ou você não tem permissão para acessá-lo.'
            }, { status: 404 });
        }

        // 2. Validate business rules - cannot delete if in certain states
        const blockedStatuses = ['em_rota', 'entregue', 'nao_entregue'];
        if (blockedStatuses.includes(order.status_logistic)) {
            const statusLabels: Record<string, string> = {
                'em_rota': 'EM ROTA',
                'entregue': 'ENTREGUE',
                'nao_entregue': 'NÃO ENTREGUE'
            };
            return NextResponse.json({
                error: `Pedido não pode ser excluído porque já está ${statusLabels[order.status_logistic]}.`
            }, { status: 400 });
        }

        // 3. Check if order is linked to a route
        const { data: routeLinks, error: routeError } = await supabase
            .from('delivery_route_orders')
            .select('id, route_id, route:delivery_routes(id, name, scheduled_date, status)')
            .eq('sales_document_id', orderId);

        if (routeError) {
            console.error('Error checking route links:', routeError);
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
                console.error('Error unlinking from route:', unlinkError);
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
            console.error('Error deleting order items:', itemsError);
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
            console.error('Error deleting order:', deleteError);
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
            console.warn('Failed to log deletion (table may not exist):', logError);
        }

        return NextResponse.json({
            success: true,
            message: 'Pedido excluído com sucesso',
            routeUpdated: !!routeToUpdate
        });

    } catch (error: any) {
        console.error('Delete Order Error:', error);
        return NextResponse.json(
            { error: error.message || 'Erro ao excluir pedido' },
            { status: 500 }
        );
    }
}
