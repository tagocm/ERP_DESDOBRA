
export type SalesStatus = 'draft' | 'sent' | 'approved' | 'confirmed' | 'cancelled' | 'lost';
export type LogisticStatus = 'pendente' | 'roteirizado' | 'agendado' | 'em_rota' | 'entregue' | 'devolvido' | 'parcial' | 'confirmado' | 'sandbox';
export type FiscalStatus = 'none' | 'authorized' | 'cancelled' | 'error';
export type FinancialStatus = 'pendente' | 'pre_lancado' | 'aprovado' | 'em_revisao' | 'cancelado';
export type DocType = 'proposal' | 'order';

export interface SalesOrder {
    id: string;
    company_id: string;
    doc_type: DocType;
    document_number: number;

    client_id: string;
    sales_rep_id?: string | null;
    price_table_id?: string | null;
    payment_terms_id?: string | null;
    payment_mode_id?: string | null;

    date_issued: string; // ISO Date YYYY-MM-DD
    valid_until?: string | null;
    delivery_date?: string | null;

    status_commercial: SalesStatus;
    status_logistic: LogisticStatus;
    status_fiscal: FiscalStatus;
    financial_status: FinancialStatus;

    // Operational Block
    dispatch_blocked?: boolean;
    dispatch_blocked_reason?: string | null;
    dispatch_blocked_at?: string | null;
    dispatch_blocked_by?: string | null;


    is_antecipada: boolean;

    subtotal_amount: number;
    discount_amount: number;
    freight_amount: number;
    total_amount: number;
    total_weight_kg?: number; // Net weight
    total_gross_weight_kg?: number; // Gross weight (new)

    // Delivery tracking (new)
    scheduled_delivery_date?: string | null; // Set when order is added to route
    delivered_at?: string | null; // Set when delivery is confirmed in return process

    delivery_address_json?: any;
    carrier_id?: string | null;

    internal_notes?: string | null;
    client_notes?: string | null;

    // Freight Details
    freight_mode?: 'cif' | 'fob' | 'exw' | 'sender' | 'recipient' | 'none' | 'third_party' | 'own_delivery' | null;
    route_tag?: string | null;
    shipping_notes?: string | null;
    volumes_qty?: number | null;
    volumes_species?: string | null;
    volumes_brand?: string | null;
    volumes_gross_weight_kg?: number | null;
    volumes_net_weight_kg?: number | null;

    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    deleted_by?: string | null;
    delete_reason?: string | null;
    invoiced_at?: string | null;
    locked_at?: string | null;

    // Joined Fields
    client?: {
        id: string;
        trade_name: string;
        document: string;
        sales_channel?: string;
        payment_terms_id?: string;
    };
    sales_rep?: {
        full_name: string;
    };
    carrier?: {
        trade_name: string;
    };
    items?: SalesItem[];
    payments?: SalesOrderPayment[];
    nfes?: SalesOrderNfe[];
    history?: SalesOrderHistory[];
    adjustments?: SalesOrderAdjustment[];

    // For Close Balance Logic
    deliveries?: {
        id: string;
        status: string;
        items: {
            sales_document_item_id: string;
            qty_delivered: number;
        }[];
    }[];
}

export interface SalesOrderItem {
    id: string;
    company_id?: string;
    document_id: string;
    item_id: string;
    quantity: number;
    qty_base?: number; // Added based on user prompt
    unit_price: number;
    discount_amount: number;
    total_amount: number;
    notes?: string | null;

    // Fiscal Calculation Fields
    fiscal_operation_id?: string | null;
    cfop_code?: string | null;
    cst_icms?: string | null;
    csosn?: string | null;
    st_applies?: boolean;
    st_base_calc?: number | null;
    st_aliquot?: number | null;
    st_value?: number | null;
    pis_cst?: string | null;
    pis_aliquot?: number | null;
    pis_value?: number | null;
    cofins_cst?: string | null;
    cofins_aliquot?: number | null;
    cofins_value?: number | null;
    ipi_applies?: boolean;
    ipi_cst?: string | null;
    ipi_aliquot?: number | null;
    ipi_value?: number | null;
    fiscal_notes?: string | null;
    fiscal_status?: 'pending' | 'calculated' | 'no_rule_found' | 'manual';
    // Snapshot fields for audit
    ncm_snapshot?: string | null;
    cest_snapshot?: string | null;
    origin_snapshot?: number | null;

    // Fulfillment & Lifecycle
    qty_fulfilled?: number;
    qty_invoiced?: number;
    qty_returned?: number;

    // Joined
    unit_weight_kg?: number | null;
    gross_weight_kg_snapshot?: number | null;

    // NFe Description Snapshots (for historical integrity)
    sales_uom_abbrev_snapshot?: string | null; // e.g., "CX", "FD"
    base_uom_abbrev_snapshot?: string | null;   // e.g., "PC", "KG"
    conversion_factor_snapshot?: number | null;  // e.g., 12 (qty_in_base)
    sales_unit_label_snapshot?: string | null;   // e.g., "CX 12xPC"

    product?: {
        id: string;
        name: string;
        sku?: string;
        un?: string; // unit name
        base_weight_kg?: number; // Legacy
        net_weight_kg_base?: number | null;
        net_weight_g_base?: number | null;
        gross_weight_kg_base?: number | null;
        gross_weight_g_base?: number | null;
        packagings?: ItemPackaging[]; // Available packagings
    };
    packaging_id?: string | null;
    packaging?: ItemPackaging; // Selected packaging details
}

export type SalesItem = SalesOrderItem;


export interface ItemPackaging {
    id: string;
    item_id: string;
    type: string;
    label: string;
    qty_in_base: number;
    gtin_ean?: string;
    net_weight_kg?: number;
    gross_weight_kg?: number;
    is_default_sales_unit: boolean;
    is_active: boolean;
}

export interface SalesOrderAdjustment {
    id: string;
    company_id: string;
    sales_document_id: string;
    type: 'credit' | 'debit' | 'return';
    amount: number;
    reason?: string;
    created_by?: string;
    created_at: string;
    created_by_user?: {
        full_name: string;
    };
}

export interface SalesOrderPayment {
    id: string;
    document_id: string;
    installment_number: number;
    due_date: string;
    amount: number;
    status: 'pending' | 'paid' | 'discounted';
    notes?: string | null;
}

export interface SalesOrderNfe {
    id: string;
    document_id: string;
    nfe_number?: number;
    nfe_series?: number;
    nfe_key?: string;
    status: 'authorized' | 'cancelled' | 'processing' | 'error';
    issued_at?: string;
    is_antecipada: boolean;
    details?: string;
}

export interface SalesOrderHistory {
    id: string;
    document_id: string;
    user_id?: string;
    event_type: string;
    description: string;
    metadata?: any;
    created_at: string;

    user?: {
        full_name: string;
    };
}

export interface DeliveryRoute {
    id: string;
    company_id: string;
    name: string;
    route_date: string;
    scheduled_date?: string | null; // When set, route appears in calendar. When NULL, appears in unscheduled dashboard
    status: 'planned' | 'closed' | 'in_transit' | 'done' | 'em_rota' | 'concluida' | 'in_progress' | 'cancelada';
    created_at: string;

    // Joined
    orders?: DeliveryRouteOrder[];
}

export interface DeliveryRouteOrder {
    id: string;
    route_id: string;
    sales_document_id: string;
    position: number;
    volumes?: number;
    assigned_at: string;
    loading_status?: 'pending' | 'loaded' | 'partial' | 'not_loaded';
    partial_payload?: any;

    // Joined
    sales_order?: SalesOrder;
}
