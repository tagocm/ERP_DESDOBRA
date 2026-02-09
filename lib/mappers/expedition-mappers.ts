import type { SandboxOrderDTO, DeliveryRouteDTO, OrderItemDTO, RouteStatus } from '@/lib/types/expedition-dto';

/**
 * Mappers to convert database objects to serializable DTOs
 * These ensure no Date objects, BigInt, or complex prototypes are sent to client
 */

export function toOrderItemDTO(item: any): OrderItemDTO {
    return {
        id: item.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_weight_kg: item.unit_weight_kg,
        balance: item.balance ?? 0,
        delivered: item.delivered ?? 0,
        packaging: item.packaging ? {
            id: item.packaging.id,
            label: item.packaging.label,
            qty_in_base: item.packaging.qty_in_base
        } : null,
        product: item.product ? {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            net_weight_g_base: item.product.net_weight_g_base
        } : null
    };
}

export function toSandboxOrderDTO(order: any): SandboxOrderDTO {
    return {
        id: order.id,
        document_number: order.document_number,
        total_amount: order.total_amount,
        date_issued: order.date_issued, // Already string from DB
        status_commercial: order.status_commercial,
        status_logistic: order.status_logistic,
        total_weight_kg: order.total_weight_kg,
        original_weight: order.original_weight,
        original_amount: order.original_amount,
        is_partial_balance: order.is_partial_balance ?? false,
        client: order.client ? {
            trade_name: order.client.trade_name
        } : null,
        items: (order.items || []).map(toOrderItemDTO)
    };
}

export function toDeliveryRouteDTO(route: any): DeliveryRouteDTO {
    return {
        id: route.id,
        name: route.name,
        route_date: route.route_date, // Already string from DB
        scheduled_date: route.scheduled_date, // Already string or null from DB
        status: route.status as RouteStatus,
        company_id: route.company_id,
        created_at: route.created_at, // Already string from DB
        orders: (route.orders || []).map((ro: any) => ({
            id: ro.id,
            position: ro.position,
            volumes: ro.volumes,
            loading_status: ro.loading_status,
            partial_payload: ro.partial_payload,
            sales_document_id: ro.sales_document_id,
            sales_order: ro.sales_order ? toSandboxOrderDTO(ro.sales_order) : null
        }))
    };
}
