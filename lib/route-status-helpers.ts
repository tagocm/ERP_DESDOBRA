import { normalizeLoadingStatus, normalizeRouteStatus } from "@/lib/constants/status";

/**
 * Get order status for display in route scheduling view
 * Returns color indicator based on loading/return status
 */
export type OrderStatusIndicator = 'green' | 'yellow' | 'red' | 'neutral';

export function getOrderStatusIndicator(order: any, routeOrder: any): OrderStatusIndicator {
    // Priority 1: Check return/delivery outcome (after route is completed)
    if (routeOrder?.return_outcome) {
        switch (routeOrder.return_outcome) {
            case 'ENTREGUE':
                return 'green';
            case 'DEVOLVIDO_PARCIAL':
                return 'yellow';
            case 'NAO_ENTREGUE':
            case 'DEVOLVIDO':
                return 'red';
        }
    }

    // Priority 2: Check loading status (from expedition)
    if (routeOrder?.loading_status) {
        const normalizedLoading = normalizeLoadingStatus(routeOrder.loading_status) || routeOrder.loading_status;
        switch (normalizedLoading) {
            case 'loaded':
                return 'green';
            case 'partial':
                return 'yellow';
            case 'not_loaded':
                return 'red';
            default:
                return 'neutral';
        }
    }

    // Priority 3: Legacy support - check old loading_checked field
    if (order?.loading_checked) {
        return 'green';
    }

    // Default: neutral (not yet processed)
    return 'neutral';
}

/**
 * Get route status color based on logistics status
 */
export type RouteStatusColor = 'neutral' | 'yellow' | 'green' | 'red';

export function getRouteStatusColor(route: any): RouteStatusColor {
    const status = normalizeRouteStatus(route?.status_logistico || route?.status) || route?.status_logistico || route?.status;

    switch (status) {
        case 'cancelled':
            return 'red';
        case 'in_route':
        case 'in_progress':
            return 'yellow';
        case 'completed':
            return 'green';
        case 'scheduled':
        default:
            return 'neutral';
    }
}
