// Product-related DTOs (serializable types only)

export interface UomDTO {
    id: string;
    company_id: string | null;
    name: string;
    abbrev: string;
    is_active: boolean;
    sort_order: number;
    usage_count?: number;
}

export interface CategoryDTO {
    id: string;
    company_id: string | null;
    name: string;
    normalized_name: string;
    product_count?: number;
}

export interface TaxGroupDTO {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    ncm: string | null;
    cest: string | null;
    origin_default: number | null;
    is_active: boolean;
    observation: string | null;
}

export interface PackagingTypeDTO {
    id: string;
    company_id: string | null;
    name: string;
    code: string;
    is_active: boolean;
    sort_order: number;
    usage_count?: number;
}

export interface CfopDTO {
    id: string; // usually same as codigo if no UUID
    codigo: string;
    descricao: string;
    tipo_operacao: 'entrada' | 'saida';
    ambito: 'estadual' | 'interestadual' | 'exterior';
    ativo: boolean;
}

export interface ItemPackagingDTO {
    id: string;
    item_id: string;
    company_id: string;
    type: string;
    label: string;
    qty_in_base: number;
    gtin_ean?: string | null;
    net_weight_kg?: number | null;
    gross_weight_kg?: number | null;
    height_cm?: number | null;
    width_cm?: number | null;
    length_cm?: number | null;
    is_default_sales_unit: boolean;
    is_active: boolean;
    is_used?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface ItemByproductDTO {
    id: string;
    company_id: string;
    bom_id: string;
    item_id: string;
    qty: number;
    basis: 'PERCENT' | 'FIXED';
    notes?: string | null;
    item?: {
        name: string;
        uom: string;
        sku?: string | null;
    };
}

export interface ProductDTO {
    id: string;
    company_id: string;
    type: 'raw_material' | 'wip' | 'finished_good' | 'service' | 'packaging' | 'other';
    name: string;
    sku: string;

    // Inventory
    control_stock: boolean;
    min_stock?: number | null;
    max_stock?: number | null;
    reorder_point?: number | null;
    default_location?: string | null;
    control_batch: boolean;
    control_expiry: boolean;

    // Purchase
    preferred_supplier_id?: string | null;
    lead_time_days?: number | null;
    purchase_notes?: string | null;
    last_cost?: number | null;

    // Sales
    is_sellable: boolean;
    default_price_list_id?: string | null;
    default_commission_percent?: number | null;
    sales_notes?: string | null;
    sales_price?: number | null;

    // Fiscal
    ncm?: string | null;
    cest?: string | null;
    origin?: number | null;
    cfop_default?: string | null; // @deprecated
    cfop_code?: string | null;
    tax_group_id?: string | null;
    has_fiscal_output: boolean;
    icms_rate?: number | null;
    ipi_rate?: number | null;
    pis_rate?: number | null;
    cofins_rate?: number | null;

    // Production
    is_produced: boolean;
    default_bom_id?: string | null;
    batch_size?: number | null;
    production_notes?: string | null;

    // System
    is_active: boolean;
    created_at: string;
    updated_at: string;

    // Joined/Computed
    uom?: UomDTO | null;
    uom_id: string | null;
    packagings?: ItemPackagingDTO[];
    category?: CategoryDTO | null;

    // Profiles (Optional, if returned by certain queries)
    inventory?: any | null;
    purchase?: any | null;
    sales?: any | null;
    fiscal?: any | null;
    production?: any | null;
}

export interface ProductFormDataDTO {
    name: string;
    sku: string;
    type: 'raw_material' | 'wip' | 'finished_good' | 'service' | 'packaging' | 'other';
    uom: string; // @deprecated
    uom_id?: string;
    gtin_ean_base?: string;
    net_weight_kg_base?: number;
    gross_weight_kg_base?: number;
    height_base?: number;
    width_base?: number;
    length_base?: number;

    brand?: string;
    line?: string; // @deprecated
    category_id?: string;
    description?: string;
    image_url?: string;
    is_active: boolean;

    packagings: Partial<ItemPackagingDTO>[];

    control_stock: boolean;
    min_stock?: number;
    max_stock?: number;
    reorder_point?: number;
    default_location?: string;
    control_batch: boolean;
    control_expiry: boolean;

    preferred_supplier_id?: string;
    lead_time_days?: number;
    purchase_uom?: string; // @deprecated
    purchase_uom_id?: string;
    default_purchase_packaging_id?: string;
    conversion_factor?: number; // @deprecated
    purchase_notes?: string;

    is_sellable: boolean;
    default_price_list_id?: string;
    default_commission_percent?: number;
    sales_notes?: string;

    ncm?: string;
    cest?: string;
    origin?: number;
    cfop_default?: string; // @deprecated
    cfop_code?: string;
    tax_group_id?: string;
    has_fiscal_output: boolean;
    icms_rate?: number;
    ipi_rate?: number;
    pis_rate?: number;
    cofins_rate?: number;

    is_produced: boolean;
    default_bom_id?: string;
    batch_size?: number;
    production_uom?: string;
    production_uom_id?: string;
    loss_percent?: number;
    production_notes?: string;
    byproducts: Partial<ItemByproductDTO>[];
}
