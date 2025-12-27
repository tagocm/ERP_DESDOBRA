
import { SupabaseClient } from '@supabase/supabase-js';
import { SalesOrder, DeliveryRoute } from '@/types/sales';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export async function getSandboxOrders(supabase: SupabaseClient, companyId: string) {
    // Sandbox: Confirmed orders NOT in any route
    // Using NOT EXISTS via left join with null check for better performance
    const { data, error } = await supabase
        .from('sales_documents')
        .select(`
            id, document_number, total_amount, date_issued, status_commercial, status_logistic,
            client:organizations!client_id(trade_name)
        `)
        .eq('company_id', companyId)
        .eq('status_commercial', 'confirmed')
        .eq('status_logistic', 'pending')
        .is('deleted_at', null)
        .order('date_issued', { ascending: false });

    if (error) throw error;

    return data || [];
}

export async function getRoutes(supabase: SupabaseClient, companyId: string, dateFrom?: string, dateTo?: string) {
    let query = supabase
        .from('delivery_routes')
        .select(`
            *,
            orders:delivery_route_orders(
                id, position, sales_document_id,
                sales_document:sales_documents(
                    id, document_number, total_amount, date_issued, status_commercial, status_logistic,
                    client:organizations!client_id(trade_name)
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
    const routes = data?.map((route: any) => ({
        ...route,
        orders: route.orders?.sort((a: any, b: any) => a.position - b.position) || []
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
    // Actually just soft-delete by removing all orders first
    const { error: ordersError } = await supabase
        .from('delivery_route_orders')
        .delete()
        .eq('route_id', routeId);

    if (ordersError) throw ordersError;

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
    const { error } = await supabase.from('delivery_route_orders').insert({
        company_id: companyId,
        route_id: routeId,
        sales_document_id: orderId,
        position
    });

    if (error) throw error;

    // Update order status to 'roteirizado'
    const { error: updateError } = await supabase
        .from('sales_documents')
        .update({ status_logistic: 'roteirizado' })
        .eq('id', orderId)
        .not('status_logistic', 'in', '(entregue,nao_entregue)');

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
        .update({ status_logistic: 'pending' })
        .eq('id', orderId)
        .not('status_logistic', 'in', '(entregue,nao_entregue,em_rota)');

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

        // Update logistics status of all orders in this route (except already delivered/not delivered)
        const { error: updateError } = await supabase
            .from('sales_documents')
            .update({ status_logistic: targetStatus })
            .in('id', orderIds)
            .not('status_logistic', 'in', '(entregue,nao_entregue)');

        if (updateError) throw updateError;
    }

    return data;
}

export async function getScheduledRoutes(supabase: SupabaseClient, companyId: string, weekStart: string, weekEnd: string) {
    let query = supabase
        .from('delivery_routes')
        .select(`
            *,
            orders:delivery_route_orders(
                id, position, sales_document_id,
                sales_document:sales_documents(
                    id, document_number, total_amount, date_issued, status_commercial, status_logistic,
                    client:organizations!client_id(trade_name)
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
    const routes = data?.map((route: any) => ({
        ...route,
        orders: route.orders?.sort((a: any, b: any) => a.position - b.position) || []
    }));

    return routes as DeliveryRoute[];
}

export async function getUnscheduledRoutes(supabase: SupabaseClient, companyId: string) {
    const query = supabase
        .from('delivery_routes')
        .select(`
            *,
            orders:delivery_route_orders(
                id, position, sales_document_id,
                sales_document:sales_documents(
                    id, document_number, total_amount, date_issued, status_commercial, status_logistic,
                    client:organizations!client_id(trade_name)
                )
            )
        `)
        .eq('company_id', companyId)
        .is('scheduled_date', null)
        .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    // Sort orders by position
    const routes = data?.map((route: any) => ({
        ...route,
        orders: route.orders?.sort((a: any, b: any) => a.position - b.position) || []
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
                id, position, sales_document_id,
                sales_document:sales_documents(
                    id, document_number, total_amount, status_logistic,
                    loading_checked, loading_checked_at,
                    client:organizations!client_id(
                        id, trade_name, legal_name,
                        addresses(city, state)
                    ),
                    items:sales_document_items(
                        id, quantity, unit_price,
                        product:items(id, name, sku, uom)
                    )
                )
            )
        `)
        .eq('company_id', companyId)
        .not('scheduled_date', 'is', null);

    if (filters?.dateFrom) query = query.gte('scheduled_date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('scheduled_date', filters.dateTo);

    // Filter by logistics status if needed
    if (!filters?.includeInRoute) {
        // Only show AGENDADO routes (default)
        // Note: This filters at route level, might need to check order status
    }

    query = query.order('scheduled_date');

    const { data, error } = await query;
    if (error) throw error;

    // Sort orders by position
    const routes = data?.map((route: any) => ({
        ...route,
        orders: route.orders?.sort((a: any, b: any) => a.position - b.position) || []
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
    // Get all orders from route
    const { data: routeOrders } = await supabase
        .from('delivery_route_orders')
        .select('sales_document_id')
        .eq('route_id', routeId);

    if (!routeOrders || routeOrders.length === 0) {
        throw new Error('Nenhum pedido encontrado nesta rota');
    }

    const orderIds = routeOrders.map(ro => ro.sales_document_id);

    // Update orders to EM_ROTA (except finished ones)
    const { error } = await supabase
        .from('sales_documents')
        .update({ status_logistic: 'em_rota' })
        .in('id', orderIds)
        .not('status_logistic', 'in', '(entregue,nao_entregue)');

    if (error) throw error;

    return { affected: orderIds.length };
}
