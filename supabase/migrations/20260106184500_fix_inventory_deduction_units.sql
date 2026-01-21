-- Fix inventory deduction to respect packaging units (multiply by factor)
-- Migration: 20260106184500_fix_inventory_deduction_units.sql

CREATE OR REPLACE FUNCTION public.deduct_stock_from_route(p_route_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    r_delivery RECORD;
    r_item RECORD;
    v_source_ref TEXT;
BEGIN
    FOR r_delivery IN
        SELECT * FROM public.deliveries WHERE route_id = p_route_id
    LOOP
        v_source_ref := concat('Entrega #', r_delivery.number);

        FOR r_item IN
            SELECT 
                di.*, 
                sdi.item_id,
                COALESCE(ip.qty_in_base, 1) as pkg_factor,
                COALESCE(ip.label, 'UN') as pkg_label
            FROM public.delivery_items di
            JOIN public.sales_document_items sdi ON sdi.id = di.sales_document_item_id
            LEFT JOIN public.item_packaging ip ON ip.id = sdi.packaging_id
            WHERE di.delivery_id = r_delivery.id
        LOOP
            -- Calculate real quantity in base units
            -- quantity = stored_qty * packaging_factor
            -- e.g. 1 Box * 12 = 12
            
            IF NOT EXISTS (
                SELECT 1 FROM public.inventory_movements
                WHERE reference_type = 'delivery_item'
                AND reference_id = r_item.id
                AND movement_type = 'SAIDA'
            ) THEN
                INSERT INTO public.inventory_movements (
                    company_id,
                    item_id,
                    movement_type,
                    qty_base,
                    reference_type,
                    reference_id,
                    source_ref,
                    notes,
                    created_by,
                    created_at,
                    updated_at,
                    occurred_at,
                    reason,
                    qty_in,
                    qty_out,
                    uom_label,
                    conversion_factor
                ) 
                VALUES (
                    r_delivery.company_id,
                    r_item.item_id,
                    'SAIDA',
                    -1 * (r_item.qty_loaded * r_item.pkg_factor), -- Negative for SAIDA
                    'delivery_item',
                    r_item.id,
                    v_source_ref,
                    concat('Baixa por entrega em rota: ', r_item.qty_loaded, ' ', r_item.pkg_label),
                    p_user_id,
                    NOW(),
                    NOW(),
                    NOW(),
                    'sale_out',
                    0,
                    (r_item.qty_loaded * r_item.pkg_factor), -- Positive value for qty_out column
                    r_item.pkg_label,
                    r_item.pkg_factor
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.deduct_stock_from_route(UUID, UUID) TO authenticated;
