// DTOs for expedition data (plain objects, serializable)
// These types represent data that will be sent from Server Actions to Client Components

// Route status type (matches DeliveryRoute.status from types/sales.ts)
export type RouteStatus =
    | 'planned'
    | 'closed'
    | 'in_transit'
    | 'done'
    | 'em_rota'
    | 'concluida'
    | 'in_progress'
    | 'cancelada';

export interface OrderItemDTO {
    id: string;
    quantity: number;
    unit_price: number;
    unit_weight_kg: number;
    balance: number;
    delivered: number;
    packaging: {
        id: string;
        label: string;
        qty_in_base: number;
    } | null;
    product: {
        id: string;
        name: string;
        sku: string;
        net_weight_g_base: number;
    } | null;
}

export interface SandboxOrderDTO {
    id: string;
    document_number: string;
    total_amount: number;
    date_issued: string; // ISO string
    status_commercial: string;
    status_logistic: string;
    total_weight_kg: number;
    original_weight?: number;
    original_amount?: number;
    is_partial_balance: boolean;
    client: {
        trade_name: string;
    } | null;
    items: OrderItemDTO[];
}

export interface RouteOrderDTO {
    id: string;
    position: number;
    volumes: number | null;
    loading_status: string;
    partial_payload: any;
    sales_document_id: string;
    sales_order: SandboxOrderDTO | null;
}

export interface DeliveryRouteDTO {
    id: string;
    name: string;
    route_date: string; // ISO string
    scheduled_date: string | null; // ISO string
    status: RouteStatus;
    company_id: string;
    created_at: string; // ISO string
    orders: RouteOrderDTO[];
}

// Action result types
export type ExpeditionActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: { message: string } };
