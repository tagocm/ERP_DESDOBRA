export interface InventoryMovement {
    id: string;
    company_id: string;
    item_id: string;
    movement_type: 'ENTRADA' | 'SAIDA' | 'AJUSTE';

    qty_base: number;

    reference_type?: string | null;
    reference_id?: string | null;
    source_ref?: string | null;

    qty_display?: number | null;
    uom_label?: string | null;
    conversion_factor?: number | null;

    notes?: string | null;

    occurred_at: string;
    created_at: string;
    updated_at: string;
    created_by?: string | null;

    // Joined Associations
    item?: {
        name: string;
        sku: string;
        uom_id?: string | null;
    };
    creator?: {
        full_name: string;
    };
}

export interface InventoryBalance {
    company_id: string;
    item_id: string;
    balance: number;
}
