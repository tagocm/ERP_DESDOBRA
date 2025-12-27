import { Database } from './supabase';

export type Item = Database['public']['Tables']['items']['Row'];
export type ItemPackaging = {
    id: string;
    item_id: string;
    company_id: string;
    type: 'BOX' | 'PACK' | 'BALE' | 'PALLET' | 'OTHER';
    label: string;
    qty_in_base: number;
    gtin_ean?: string | null;
    net_weight_g?: number | null;
    gross_weight_g?: number | null;
    height_cm?: number | null;
    width_cm?: number | null;
    length_cm?: number | null;
    is_default_sales_unit: boolean;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
};

export type ItemInventoryProfile = Database['public']['Tables']['item_inventory_profiles']['Row'];
export type ItemPurchaseProfile = Database['public']['Tables']['item_purchase_profiles']['Row'];
export type ItemSalesProfile = Database['public']['Tables']['item_sales_profiles']['Row'];
export type ItemFiscalProfile = Database['public']['Tables']['item_fiscal_profiles']['Row'];
export type ItemProductionProfile = Database['public']['Tables']['item_production_profiles']['Row'];



export interface Uom {
    id: string;
    company_id: string;
    name: string;
    abbrev: string;
    is_active: boolean;
    sort_order: number;
    usage_count?: number; // Virtual field for UI
}

export interface ProductCategory {
    id: string;
    name: string;
    normalized_name: string;
    product_count?: number; // Virtual field for UI
}

export interface FullProduct extends Omit<Item, 'uom'> {
    uom?: Uom | null; // Join - replaces string uom
    // Keep original uom field available if needed for migration logic as 'legacy_uom' or just access via Item if casting
    uom_id?: string | null; // From item
    inventory?: ItemInventoryProfile | null;
    purchase?: ItemPurchaseProfile | null;
    sales?: ItemSalesProfile | null;
    fiscal?: ItemFiscalProfile | null;
    production?: ItemProductionProfile | null;
    packagings?: ItemPackaging[];
    category?: ProductCategory | null; // Join
}

export type ProductFormData = {
    // Identity
    name: string;
    sku: string;
    type: Database['public']['Tables']['items']['Row']['type'];
    uom: string; // @deprecated
    uom_id?: string;
    gtin_ean_base?: string; // Renamed from gtin
    net_weight_g_base?: number;
    gross_weight_g_base?: number;
    height_base?: number;
    width_base?: number;
    length_base?: number;

    brand?: string;
    line?: string; // @deprecated use category_id
    category_id?: string;
    description?: string;
    image_url?: string;
    is_active: boolean;

    // Packagings
    packagings: Partial<ItemPackaging>[];

    // Inventory
    control_stock: boolean;
    min_stock?: number;
    max_stock?: number;
    reorder_point?: number;
    default_location?: string;
    control_batch: boolean;
    control_expiry: boolean;

    // Purchase
    preferred_supplier_id?: string;
    lead_time_days?: number;
    purchase_uom?: string;
    conversion_factor?: number;
    purchase_notes?: string;

    // Sales
    is_sellable: boolean;
    default_price_list_id?: string;
    default_commission_percent?: number;
    sales_notes?: string;

    // Fiscal
    ncm?: string;
    cest?: string;
    origin?: number;
    cfop_default?: string; // @deprecated
    cfop_code?: string;
    tax_group_id?: string;
    has_fiscal_output: boolean;
    // Simple overrides
    icms_rate?: number;
    ipi_rate?: number;
    pis_rate?: number;
    cofins_rate?: number;

    // Production
    is_produced: boolean;
    default_bom_id?: string; // For future linking
    batch_size?: number;
    production_notes?: string;
};

