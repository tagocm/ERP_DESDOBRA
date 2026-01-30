
import { SupabaseClient } from '@supabase/supabase-js';
import { SalesOrder, DeliveryRoute } from '@/types/sales';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export async function getSandboxOrders(supabase: SupabaseClient, companyId: string) {
    // Sandbox: Confirmed orders NOT in any route (pending logistic status)
    const { data: orders, error } = await supabase
        .from('sales_documents')
        .select(`
            id, document_number, total_amount, date_issued, status_commercial, status_logistic, total_weight_kg,
            client:organizations!client_id(trade_name),
            items:sales_document_items(id, quantity, unit_price, unit_weight_kg, packaging:item_packaging(id, label, qty_in_base), product:items(id, name, sku, net_weight_g_base)),
            deliveries:deliveries(
                id, status,
                items:delivery_items(sales_document_item_id, qty_delivered)
            )
        `)
        .eq('company_id', companyId)
        .eq('status_commercial', 'confirmed')
        .eq('status_commercial', 'confirmed')
        .in('status_logistic', ['pendente', 'parcial'])
        .eq('dispatch_blocked', false)
        .is('deleted_at', null)
        .order('date_issued', { ascending: false });

    if (error) throw error;

    if (!orders) return [];

    // Calculate balances
    return orders.map((order: any) => calculateOrderBalances(order));
}

export async function getRoutes(supabase: SupabaseClient, companyId: string, dateFrom?: string, dateTo?: string) {
    let query = supabase
        .from('delivery_routes')
        .select(`
            *,
            orders:delivery_route_orders(
                id, position, volumes, sales_document_id, loading_status, return_outcome,
                sales_order:sales_documents(
                    id, document_number, total_amount, date_issued, status_commercial, status_logistic, dispatch_blocked, total_weight_kg,
                    client:organizations!client_id(trade_name),
                    items:sales_document_items(id, quantity, unit_price, unit_weight_kg, packaging:item_packaging(id, label, qty_in_base), product:items(id, name, sku, net_weight_g_base)),
                    deliveries:deliveries(
                        id, status,
                        items:delivery_items(sales_document_item_id, qty_delivered)
                    ),
                    events:order_delivery_events(id, event_type, note, reason:delivery_reasons(name))
                )
            )
        `)
        .eq('company_id', companyId)
        .order('name');

    if (dateFrom) query = query.gte('route_date', dateFrom);
    if (dateTo) query = query.lte('route_date', dateTo);

    const { data, error } = await query;
    if (error) throw error;

    // Sort orders by position
    // Sort orders by position and calculate balances (for Loading Checklist etc)
    const routes = data?.map((route: any) => ({
        ...route,
        orders: route.orders?.filter((ro: any) => !ro.sales_order?.dispatch_blocked).sort((a: any, b: any) => a.position - b.position).map((ro: any) => {
            if (ro.sales_order) {
                ro.sales_order = calculateOrderBalances(ro.sales_order);
            }
            return ro;
        }) || []
    }));

    return routes as DeliveryRoute[];
}

export async function createRoute(supabase: SupabaseClient, route: Partial<DeliveryRoute>) {
    const { data, error } = await supabase
        .from('delivery_routes')
        .insert([{
            company_id: route.company_id,
            name: route.name,
            route_date: route.route_date,
            scheduled_date: route.scheduled_date
        }])
        .select()
        .single();

    if (error) throw error;
    return data as DeliveryRoute;
}

export async function deleteRoute(supabase: SupabaseClient, routeId: string) {
    // 1. Get all orders in this route
    const { data: routeOrders } = await supabase
        .from('delivery_route_orders')
        .select('sales_document_id')
        .eq('route_id', routeId);

    if (routeOrders && routeOrders.length > 0) {
        const orderIds = routeOrders.map(ro => ro.sales_document_id);

        // 2. Reset order status to 'pendente' (Sandbox)
        const { error: updateError } = await supabase
            .from('sales_documents')
            .update({
                status_logistic: 'pendente',
                scheduled_delivery_date: null
            })
            .in('id', orderIds)
            // Safety check: don't reset if already delivered/returned (though typically one wouldn't delete such a route)
            .neq('status_logistic', 'entregue')
            .neq('status_logistic', 'devolvido');

        if (updateError) throw updateError;
    }

    // 3. Delete route orders relation
    const { error: ordersError } = await supabase
        .from('delivery_route_orders')
        .delete()
        .eq('route_id', routeId);

    if (ordersError) throw ordersError;

    // 4. Delete the route itself
    const { error } = await supabase
        .from('delivery_routes')
        .delete()
        .eq('id', routeId);

    if (error) throw error;
}

export async function addOrderToRoute(
    supabase: SupabaseClient,
    routeId: string,
    orderId: string,
    position: number,
    companyId: string
) {
    // 1. Verify if order is BLOCKED
    const { data: order, error: orderError } = await supabase
        .from('sales_documents')
        .select('dispatch_blocked, dispatch_blocked_reason')
        .eq('id', orderId)
        .single();

    if (orderError) throw orderError;

    if (order?.dispatch_blocked) {
        throw new Error(`Pedido bloqueado para despacho: ${order.dispatch_blocked_reason || 'Sem motivo especificado'}`);
    }

    const { data: route } = await supabase
        .from('delivery_routes')
        .select('name, scheduled_date')
        .eq('id', routeId)
        .single();

    const isAutomaticRoute = route?.name?.toLowerCase().startsWith('rota automática');
    const loadingStatus = isAutomaticRoute ? 'loaded' : 'pendente'; // Default to pendente (gray)

    // Check if order is already in ANY ACTIVE route
    // We ignore completed/cancelled routes (history)
    const { data: existing } = await supabase
        .from('delivery_route_orders')
        .select(`
            id, 
            route_id,
            route:delivery_routes!inner (
                status
            )
        `)
        .eq('sales_document_id', orderId)
        .neq('route.status', 'concluida')
        .neq('route.status', 'cancelada')
        .maybeSingle();

    if (existing) {
        // If already in THIS route, do nothing (or update position?)
        if (existing.route_id === routeId) {
            // Already there
        } else {
            // Move to new route - update loading status if it's automatic or reset to pendente
            const updatePayload: any = {
                route_id: routeId,
                position,
                company_id: companyId
            };

            if (isAutomaticRoute) {
                updatePayload.loading_status = 'loaded';
            } else {
                // Reset to pendente when moving between routes to force re-check
                // Unless we explicitly want to keep it? Safest is to reset.
                updatePayload.loading_status = 'pendente';
                updatePayload.partial_payload = null; // Clear any partial data
            }

            const { error: moveError } = await supabase
                .from('delivery_route_orders')
                .update(updatePayload)
                .eq('id', existing.id);

            if (moveError) throw moveError;
        }
    } else {
        // Insert new (Fresh start for this route)
        // This preserves the history of the order in previous completed routes
        const { error } = await supabase.from('delivery_route_orders').insert({
            company_id: companyId,
            route_id: routeId,
            sales_document_id: orderId,
            position,
            loading_status: loadingStatus
        });
        if (error) throw error;
    }

    // Prepare update for sales_document
    const orderUpdate: any = {
        status_logistic: 'roteirizado',
        scheduled_delivery_date: route?.scheduled_date || null
    };

    if (isAutomaticRoute) {
        orderUpdate.loading_checked = true;
        orderUpdate.loading_checked_at = new Date().toISOString();
    }

    // Update order status and schedule date
    // ensure we don't accidentally overwrite 'entregue' if there's a race condition (though kanban checks this)
    const { error: updateError } = await supabase
        .from('sales_documents')
        .update(orderUpdate)
        .eq('id', orderId)
        .neq('status_logistic', 'entregue')
        .neq('status_logistic', 'devolvido');

    if (updateError) throw updateError;
}

export async function removeOrderFromRoute(supabase: SupabaseClient, routeId: string, orderId: string) {
    const { error } = await supabase
        .from('delivery_route_orders')
        .delete()
        .eq('route_id', routeId)
        .eq('sales_document_id', orderId);

    if (error) throw error;

    // Update order status back to 'pending'
    const { error: updateError } = await supabase
        .from('sales_documents')
        .update({ status_logistic: 'pendente' })
        .eq('id', orderId)
        .neq('status_logistic', 'entregue')
        .neq('status_logistic', 'devolvido')
        .neq('status_logistic', 'em_rota');

    if (updateError) throw updateError;
}

export async function reorderRouteOrders(
    supabase: SupabaseClient,
    routeId: string,
    orderIds: string[],
    companyId: string
) {
    // Update all positions
    const updates = orderIds.map((orderId, index) => ({
        company_id: companyId,
        route_id: routeId,
        sales_document_id: orderId,
        position: index
    }));

    // Delete existing and insert new
    const { error: deleteError } = await supabase
        .from('delivery_route_orders')
        .delete()
        .eq('route_id', routeId);

    if (deleteError) throw deleteError;

    const { error } = await supabase
        .from('delivery_route_orders')
        .insert(updates);

    if (error) throw error;
}

export async function updateRouteSchedule(
    supabase: SupabaseClient,
    routeId: string,
    scheduledDate: string | null
) {
    // Update the route's scheduled_date
    const { data, error } = await supabase
        .from('delivery_routes')
        .update({ scheduled_date: scheduledDate })
        .eq('id', routeId)
        .select()
        .single();

    if (error) throw error;

    // Determine target status based on whether we're scheduling or unscheduling
    const targetStatus = scheduledDate ? 'agendado' : 'roteirizado';

    // Get all orders from this route
    const { data: routeOrders } = await supabase
        .from('delivery_route_orders')
        .select('sales_document_id')
        .eq('route_id', routeId);

    if (routeOrders && routeOrders.length > 0) {
        const orderIds = routeOrders.map(ro => ro.sales_document_id);

        // Update logistics status and scheduled date of all orders in this route
        const { error: updateError } = await supabase
            .from('sales_documents')
            .update({
                status_logistic: targetStatus,
                scheduled_delivery_date: scheduledDate
            })
            .in('id', orderIds)
            .neq('status_logistic', 'entregue')
            .neq('status_logistic', 'devolvido');

        if (updateError) throw updateError;
    }

    return data;
}

export async function getScheduledRoutes(supabase: SupabaseClient, companyId: string, weekStart: string, weekEnd: string) {
    const query = supabase
        .from('delivery_routes')
        .select(`
            *,
            orders:delivery_route_orders(
                id, position, volumes, loading_status, partial_payload, sales_document_id,
                sales_order:sales_documents(
                    id, document_number, total_amount, date_issued, status_commercial, status_logistic, total_weight_kg, loading_checked,
                    client:organizations!client_id(trade_name),
                    items:sales_document_items(id, quantity, unit_price, unit_weight_kg, packaging:item_packaging(id, label, qty_in_base), product:items(id, name, sku, net_weight_g_base)),
                    deliveries:deliveries(
                        id, status,
                        items:delivery_items(sales_document_item_id, qty_delivered)
                    )
                )
            )
        `)
        .eq('company_id', companyId)
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', weekStart)
        .lte('scheduled_date', weekEnd)
        .order('scheduled_date');

    const { data, error } = await query;
    if (error) throw error;

    // Sort orders by position
    // Sort orders by position and calculate balances
    const routes = data?.map((route: any) => ({
        ...route,
        orders: route.orders?.sort((a: any, b: any) => a.position - b.position).map((ro: any) => {
            if (ro.sales_order) {
                ro.sales_order = calculateOrderBalances(ro.sales_order);
            }
            return ro;
        }) || []
    }));

    return routes as DeliveryRoute[];
}

export async function getUnscheduledRoutes(supabase: SupabaseClient, companyId: string) {
    const query = supabase
        .from('delivery_routes')
        .select(`
            *,
            orders:delivery_route_orders(
                id, position, volumes, loading_status, partial_payload, sales_document_id,
                sales_order:sales_documents(
                    id, document_number, total_amount, date_issued, status_commercial, status_logistic, total_weight_kg, loading_checked,
                    client:organizations!client_id(trade_name),
                    items:sales_document_items(id, quantity, unit_price, unit_weight_kg, packaging:item_packaging(id, label, qty_in_base), product:items(id, name, sku, net_weight_g_base)),
                    deliveries:deliveries(
                        id, status,
                        items:delivery_items(sales_document_item_id, qty_delivered)
                    )
                )
            )
        `)
        .eq('company_id', companyId)
        .is('scheduled_date', null)
        .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    // Sort orders by position
    // Sort orders by position and calculate balances
    const routes = data?.map((route: any) => ({
        ...route,
        orders: route.orders?.sort((a: any, b: any) => a.position - b.position).map((ro: any) => {
            if (ro.sales_order) {
                ro.sales_order = calculateOrderBalances(ro.sales_order);
            }
            return ro;
        }) || []
    }));

    return routes as DeliveryRoute[];
}

// ===== HELPER FUNCTIONS FOR SALES ORDER FORM (LEGACY COMPATIBILITY) =====

export async function getTodayRoutes(supabase: SupabaseClient, companyId: string) {
    const today = format(new Date(), 'yyyy-MM-dd');
    return getScheduledRoutes(supabase, companyId, today, today);
}

export async function getOrCreateDailyRoute(supabase: SupabaseClient, companyId: string) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const routeName = `Rota Diária - ${format(new Date(), 'dd/MM')}`;

    // Try to find existing
    const { data: existing } = await supabase
        .from('delivery_routes')
        .select('*')
        .eq('company_id', companyId)
        .eq('name', routeName)
        .eq('scheduled_date', today)
        .single();

    if (existing) return existing;

    // Create new
    return createRoute(supabase, {
        company_id: companyId,
        name: routeName,
        scheduled_date: today,
        route_date: today
    });
}

// ===== EXPEDITION / LOADING FUNCTIONS =====

/**
 * Get routes for expedition screen (scheduled routes with detailed loading info)
 */
export async function getExpeditionRoutes(
    supabase: SupabaseClient,
    companyId: string,
    filters?: {
        dateFrom?: string;
        dateTo?: string;
        includeInRoute?: boolean;
    }
) {
    let query = supabase
        .from('delivery_routes')
        .select(`
            *,
            orders:delivery_route_orders(
                id, position, volumes, loading_status, partial_payload, sales_document_id,
                sales_order:sales_documents(
                    id, document_number, total_amount, status_logistic, total_weight_kg, dispatch_blocked,
                    loading_checked, loading_checked_at,
                    client:organizations!client_id(
                        id, trade_name, legal_name,
                        addresses(city, state)
                    ),
                    items:sales_document_items(
                        id, quantity, unit_price, unit_weight_kg,
                        packaging:item_packaging(id, label, qty_in_base),
                        product:items(id, name, sku, uom, net_weight_g_base)
                    ),
                    deliveries:deliveries(
                        id, status,
                        items:delivery_items(sales_document_item_id, qty_delivered)
                    ),
                    events:order_delivery_events(id, event_type, note, reason:delivery_reasons(name))
                )
            )
        `)
        .eq('company_id', companyId)
        .not('scheduled_date', 'is', null);

    if (filters?.dateFrom) query = query.gte('scheduled_date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('scheduled_date', filters.dateTo);

    // Filter: Expedição only shows PLANNED routes (not yet started)
    // Routes in 'em_rota' status should appear in Retorno screen instead
    query = query.neq('status', 'em_rota').neq('status', 'concluida');

    query = query.order('scheduled_date');

    const { data, error } = await query;
    if (error) throw error;

    // Sort orders by position and calculate balances
    const routes = data?.map((route: any) => ({
        ...route,
        orders: route.orders?.filter((ro: any) => !ro.sales_order?.dispatch_blocked).sort((a: any, b: any) => a.position - b.position).map((ro: any) => {
            if (ro.sales_order) {
                ro.sales_order = calculateOrderBalances(ro.sales_order);
            }
            return ro;
        }) || []
    }));

    return routes as any[];
}

/**
 * Get routes for Retorno screen (only in_progress routes)
 */
export async function getRetornoRoutes(
    supabase: SupabaseClient,
    companyId: string,
    filters?: {
        dateFrom?: string;
        dateTo?: string;
    }
) {
    let query = supabase
        .from('delivery_routes')
        .select(`
            *,
            orders:delivery_route_orders(
                id, position, volumes, loading_status, partial_payload, return_outcome_type, return_payload, return_updated_at, sales_document_id,
                sales_order:sales_documents(
                    id, document_number, total_amount, status_logistic, total_weight_kg,
                    loading_checked, loading_checked_at,
                    client:organizations!client_id(
                        id, trade_name, legal_name,
                        addresses(city, state)
                    ),
                    items:sales_document_items(
                        id, quantity, unit_price, unit_weight_kg,
                        packaging:item_packaging(id, label, qty_in_base),
                        product:items(id, name, sku, uom, net_weight_g_base)
                    ),
                    deliveries:deliveries(
                        id, status,
                        items:delivery_items(sales_document_item_id, qty_delivered)
                    )
                )
            )
        `)
        .eq('company_id', companyId)
        .eq('status', 'em_rota'); // Only show routes that are EM_ROTA

    if (filters?.dateFrom) query = query.gte('scheduled_date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('scheduled_date', filters.dateTo);

    query = query.order('scheduled_date');

    const { data, error } = await query;
    if (error) throw error;

    // Sort orders by position and calculate balances
    const routes = data?.map((route: any) => ({
        ...route,
        orders: route.orders?.sort((a: any, b: any) => a.position - b.position).map((ro: any) => {
            if (ro.sales_order) {
                ro.sales_order = calculateOrderBalances(ro.sales_order);
            }
            return ro;
        }) || []
    }));

    return routes as any[];
}


/**
 * Get product separation list (aggregated by SKU) for a route
 */
export async function getProductSeparationList(
    supabase: SupabaseClient,
    routeId: string
) {
    const { data, error } = await supabase.rpc('get_route_product_aggregation', {
        p_route_id: routeId
    });

    if (error) throw error;
    return data;
}

/**
 * Update loading checked status for an order
 */
export async function updateLoadingChecked(
    supabase: SupabaseClient,
    orderId: string,
    checked: boolean,
    userId?: string
) {
    const updates: any = {
        loading_checked: checked,
        loading_checked_at: checked ? new Date().toISOString() : null,
        loading_checked_by: checked ? userId : null
    };

    const { error } = await supabase
        .from('sales_documents')
        .update(updates)
        .eq('id', orderId);

    if (error) throw error;
}

/**
 * Start route - change route and orders to EM_ROTA status
 */
export async function startRoute(
    supabase: SupabaseClient,
    routeId: string
) {
    // We delegate the complex logic (partial splits, order duplication) to the Server API
    const response = await fetch('/api/expedition/start-route', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ routeId })
    });

    if (!response.ok) {
        let errorMessage = 'Failed to start route';
        try {
            const err = await response.json();
            errorMessage = err.error || errorMessage;
        } catch (e) {
            // ignore json parse error
        }
        throw new Error(errorMessage);
    }

    return await response.json();
}

/**
 * Check for and cleanup expired routes (scheduled for past dates but not processed)
 */
export async function checkAndCleanupExpiredRoutes(supabase: SupabaseClient, companyId: string) {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Get routes scheduled before today
    const { data: expiredCandidates, error } = await supabase
        .from('delivery_routes')
        .select(`
            id, 
            orders:delivery_route_orders(
                sales_order:sales_documents(status_logistic)
            )
        `)
        .eq('company_id', companyId)
        .lt('scheduled_date', today)
        .not('scheduled_date', 'is', null);

    if (error) throw error;
    if (!expiredCandidates || expiredCandidates.length === 0) return 0;

    // Filter routes that are truly "unprocessed"
    // Unprocessed = No orders are 'em_rota', 'entregue', 'nao_entregue'
    // If a route has NO orders, it is also considered unprocessed/expired
    const toResetIds = expiredCandidates
        .filter((route: any) => {
            const orders = route.orders || [];
            if (orders.length === 0) return true;

            const hasProcessedOrders = orders.some((o: any) =>
                ['em_rota', 'entregue', 'devolvido', 'parcial'].includes(o.sales_order?.status_logistic)
            );

            return !hasProcessedOrders;
        })
        .map((r: any) => r.id);

    if (toResetIds.length === 0) return 0;

    // Reset scheduled_date to null
    const { error: updateError } = await supabase
        .from('delivery_routes')
        .update({ scheduled_date: null })
        .in('id', toResetIds);

    if (updateError) throw updateError;

    // Reset status_logistic of orders in these routes to 'roteirizado' (since they are no longer scheduled)
    // We get all orders from these routes first
    const { data: routeOrders } = await supabase
        .from('delivery_route_orders')
        .select('sales_document_id')
        .in('route_id', toResetIds);

    if (routeOrders && routeOrders.length > 0) {
        const orderIds = routeOrders.map(ro => ro.sales_document_id);

        await supabase
            .from('sales_documents')
            .update({
                status_logistic: 'roteirizado',
                scheduled_delivery_date: null
            })
            .in('id', orderIds)
            .neq('status_logistic', 'entregue')
            .neq('status_logistic', 'devolvido')
            .neq('status_logistic', 'em_rota');
    }

    return toResetIds.length;
}

/**
 * Update volumes for an order in a route
 */
export async function updateOrderVolumes(
    supabase: SupabaseClient,
    routeId: string,
    orderId: string,
    volumes: number
) {
    const { error } = await supabase
        .from('delivery_route_orders')
        .update({ volumes })
        .eq('route_id', routeId)
        .eq('sales_document_id', orderId);

    if (error) throw error;
}

/**
 * Finish route - mark route as completed after return process
 */
export async function finishRoute(
    supabase: SupabaseClient,
    routeId: string
) {
    // Update route status to CONCLUIDA
    const { error } = await supabase
        .from('delivery_routes')
        .update({ status: 'concluida' })
        .eq('id', routeId);

    if (error) throw error;

    return { success: true };
}

/**
 * Get completed routes for history
 */
export async function getCompletedRoutes(
    supabase: SupabaseClient,
    companyId: string,
    filters?: {
        startDate?: string;
        endDate?: string;
        search?: string;
    }
) {
    let query = supabase
        .from('delivery_routes')
        .select(`
            id,
            name,
            route_date,
            created_at,
            status,
            orders:delivery_route_orders(
                id,
                sales_document_id,
                sales_order:sales_documents!sales_document_id(
                    id,
                    total_amount,
                    document_number,
                    total_weight_kg,
                    status_logistic,
                    client:organizations!client_id(trade_name)
                )
            )
        `)
        .eq('company_id', companyId)
        .eq('status', 'concluida')
        .order('route_date', { ascending: false });

    if (filters?.startDate) {
        query = query.gte('route_date', filters.startDate);
    }
    if (filters?.endDate) {
        query = query.lte('route_date', filters.endDate);
    }
    if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

/**
 * Get details of a completed route
 */
export async function getCompletedRouteDetails(supabase: SupabaseClient, routeId: string, companyId: string) {
    const { data, error } = await supabase
        .from('delivery_routes')
        .select(`
            *,
            orders:delivery_route_orders(
                id,
                sales_document_id,
                volumes,
                sales_order:sales_documents!sales_document_id(
                    id,
                    document_number,
                    total_amount,
                    status_logistic,
                    internal_notes,
                    date_issued,
                    client:organizations!client_id(trade_name),
                    items:sales_document_items(
                        id,
                        item_id,
                        quantity,
                        unit_price,
                        total_amount,
                        item:items(name)
                    )
                )
            )
        `)
        .eq('id', routeId)
        .eq('company_id', companyId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update return staging data for a route order
 */
export async function updateReturnStaging(
    supabase: SupabaseClient,
    routeOrderId: string,
    outcomeType: string,
    payload: any
) {
    const { error } = await supabase
        .from('delivery_route_orders')
        .update({
            return_outcome_type: outcomeType,
            return_payload: payload,
            return_updated_at: new Date().toISOString()
        })
        .eq('id', routeOrderId);

    if (error) throw error;
}

/**
 * Get or create an automatic route for immediate dispatch.
 * Status: em_rota
 * Name: Rota Automática - dd/MM/yyyy
 */
export async function getOrCreateAutomaticDispatcherRoute(supabase: SupabaseClient, companyId: string) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const displayDate = format(new Date(), 'dd/MM/yyyy');

    // 1. Check for existing OPEN automatic route (em_rota)
    const { data: existing } = await supabase
        .from('delivery_routes')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'em_rota')
        .ilike('name', `Rota Automática%`)
        .gte('route_date', today)
        .limit(1)
        .maybeSingle();

    if (existing) return existing;

    // 2. Create new if not found
    const time = format(new Date(), 'HH:mm');
    const routeName = `Rota Automática - ${displayDate} - ${time}`;

    const { data: newRoute, error } = await supabase
        .from('delivery_routes')
        .insert([{
            company_id: companyId,
            name: routeName,
            route_date: today,
            scheduled_date: today,
            status: 'em_rota'
        }])
        .select()
        .single();

    if (error) throw error;
    return newRoute;
}

/**
 * Reset loading status and unschedule a route (Cancel Route action)
 */
export async function resetAndUnscheduleRoute(
    supabase: SupabaseClient,
    routeId: string
) {
    // 1. Reset loading_status, return_outcome, etc in delivery_route_orders
    const { error: resetError } = await supabase
        .from('delivery_route_orders')
        .update({
            loading_status: 'pendente',
            partial_payload: null,
            return_outcome_type: null,
            return_payload: null,
            return_updated_at: null
        })
        .eq('route_id', routeId);

    if (resetError) throw resetError;

    // 2. Unschedule the route
    const { error: routeError } = await supabase
        .from('delivery_routes')
        .update({
            scheduled_date: null,
            status: 'pendente'
        })
        .eq('id', routeId);

    if (routeError) throw routeError;

    // 3. Update Sales Documents status to 'roteirizado'
    const { data: routeOrders } = await supabase
        .from('delivery_route_orders')
        .select('sales_document_id')
        .eq('route_id', routeId);

    if (routeOrders && routeOrders.length > 0) {
        const orderIds = routeOrders.map(ro => ro.sales_document_id);

        await supabase
            .from('sales_documents')
            .update({
                status_logistic: 'roteirizado',
                scheduled_delivery_date: null,
                loading_checked: false,
                loading_checked_at: null,
                loading_checked_by: null
            })
            .in('id', orderIds)
            .neq('status_logistic', 'entregue')
            .neq('status_logistic', 'devolvido');
    }
}
// Helper function to calculate order balances (Partial Delivery Logic)
function calculateOrderBalances(order: any) {
    let totalBalanceWeight = 0;
    let totalBalanceAmount = 0;
    let hasPartialDelivery = false;

    // Map of Delivered Qty per Item ID
    const deliveredMap = new Map<string, number>();

    if (order.deliveries && order.deliveries.length > 0) {
        order.deliveries.forEach((d: any) => {
            if (d.status === 'delivered' || d.status === 'returned_partial' || d.status === 'returned_total') {
                d.items?.forEach((di: any) => {
                    const current = deliveredMap.get(di.sales_document_item_id) || 0;
                    deliveredMap.set(di.sales_document_item_id, current + (di.qty_delivered || 0));
                });
            }
        });
    }

    const itemsWithBalance = order.items?.map((item: any) => {
        const delivered = deliveredMap.get(item.id) || 0;

        // Calculate balance: quantity - delivered
        const balance = Math.max(0, item.quantity - delivered);

        if (delivered > 0) hasPartialDelivery = true;

        const itemWeightKg = item.unit_weight_kg || ((item.product?.net_weight_g_base || 0) / 1000);
        totalBalanceWeight += (balance * itemWeightKg);
        totalBalanceAmount += (balance * item.unit_price);

        return { ...item, balance, delivered };
    });

    return {
        ...order,
        original_weight: order.total_weight_kg,
        original_amount: order.total_amount,
        total_weight_kg: hasPartialDelivery ? totalBalanceWeight : (order.total_weight_kg || totalBalanceWeight),
        total_amount: hasPartialDelivery ? totalBalanceAmount : (order.total_amount || totalBalanceAmount),
        is_partial_balance: hasPartialDelivery,
        items: itemsWithBalance
    };
}
