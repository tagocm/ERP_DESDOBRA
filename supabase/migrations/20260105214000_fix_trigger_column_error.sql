
-- Migration: Fix Weight Trigger - Remove non-existent manual_weight_override check
-- Description: Removes check for 'manual_weight_override' which does not exist on sales_document_items, causing updates to fail.

CREATE OR REPLACE FUNCTION public.compute_sales_document_item_weight() RETURNS TRIGGER AS $$
DECLARE
    v_gross_g numeric;
    v_net_g numeric;
    v_unit_weight numeric;
    v_packaging RECORD;
    v_item RECORD;
    v_source text;
    v_snapshot jsonb;
BEGIN
    -- Removed manual_weight_override check as column does not exist
    
    -- Fetch Item Base Info
    SELECT * INTO v_item FROM public.items WHERE id = NEW.item_id;

    -- Decision Logic
    IF NEW.packaging_id IS NOT NULL THEN
        -- Case: Packaging Selected
        SELECT * INTO v_packaging FROM public.item_packaging WHERE id = NEW.packaging_id;
        
        IF v_packaging.gross_weight_kg IS NOT NULL AND v_packaging.gross_weight_kg > 0 THEN
            v_unit_weight := v_packaging.gross_weight_kg;
        ELSIF v_packaging.net_weight_kg IS NOT NULL THEN
            v_unit_weight := v_packaging.net_weight_kg;
        ELSE 
             v_unit_weight := NULL;
        END IF;

        v_source := 'packaging';
        
        v_snapshot := jsonb_build_object(
            'source', 'packaging',
            'packaging_id', NEW.packaging_id,
            'pkg_gross_kg', v_packaging.gross_weight_kg,
            'pkg_net_kg', v_packaging.net_weight_kg,
            'calc_unit_weight', v_unit_weight
        );

        IF v_unit_weight IS NOT NULL THEN
            NEW.total_weight_kg := v_unit_weight * NEW.quantity;
        ELSE 
            NEW.total_weight_kg := 0;
        END IF;
        
    ELSE
        -- Case: No Packaging (Base Unit)
        
        IF v_item.gross_weight_kg_base IS NOT NULL AND v_item.gross_weight_kg_base > 0 THEN
             v_unit_weight := v_item.gross_weight_kg_base;
        ELSIF v_item.gross_weight_g_base IS NOT NULL AND v_item.gross_weight_g_base > 0 THEN
             v_unit_weight := v_item.gross_weight_g_base / 1000.0;
             
        ELSIF v_item.net_weight_kg_base IS NOT NULL AND v_item.net_weight_kg_base > 0 THEN
             v_unit_weight := v_item.net_weight_kg_base;
        ELSIF v_item.net_weight_g_base IS NOT NULL AND v_item.net_weight_g_base > 0 THEN
             v_unit_weight := v_item.net_weight_g_base / 1000.0;
        ELSE 
             v_unit_weight := NULL;
        END IF;
        
        v_source := 'product_base';

        v_snapshot := jsonb_build_object(
            'source', 'product_base',
            'item_id', NEW.item_id,
            'gross_weight_kg_base', v_item.gross_weight_kg_base,
            'net_weight_kg_base', v_item.net_weight_kg_base,
            'calc_unit_weight', v_unit_weight
        );

        -- Use COALESCE to ensure we have a quantity even if NEW.qty_base is null (it shouldn't be if partial update carries over, but let's be safe)
        -- Note: In PG Trigger, NEW contains all columns.
        IF v_unit_weight IS NOT NULL THEN
            NEW.total_weight_kg := v_unit_weight * COALESCE(NEW.qty_base, NEW.quantity, 0);
        ELSE
            NEW.total_weight_kg := 0;
        END IF;
    END IF;

    -- Assign Final Values
    NEW.unit_weight_kg := v_unit_weight;
    NEW.weight_source := v_source;
    NEW.weight_snapshot := v_snapshot;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
