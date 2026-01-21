-- Migration: Update Weight Calculation Trigger to use KG columns
-- Description: Updates compute_sales_document_item_weight to reference _kg columns instead of _g columns.

CREATE OR REPLACE FUNCTION public.compute_sales_document_item_weight() RETURNS TRIGGER AS $$
DECLARE
    v_gross_g numeric;
    v_net_g numeric;
    v_base_kg numeric;
    v_unit_weight numeric;
    v_packaging RECORD;
    v_item RECORD;
    v_source text;
    v_snapshot jsonb;
BEGIN
    -- Skip if manual override is true
    IF NEW.manual_weight_override = true THEN
        RETURN NEW;
    END IF;

    -- Fetch Item Base Info
    SELECT * INTO v_item FROM public.items WHERE id = NEW.item_id;

    -- Decision Logic
    IF NEW.packaging_id IS NOT NULL THEN
        -- Case: Packaging Selected
        SELECT * INTO v_packaging FROM public.item_packaging WHERE id = NEW.packaging_id;
        
        -- Use Packaging Gross -> Net (Already in KG)
        IF v_packaging.gross_weight_kg IS NOT NULL AND v_packaging.gross_weight_kg > 0 THEN
            v_unit_weight := v_packaging.gross_weight_kg;
        ELSIF v_packaging.net_weight_kg IS NOT NULL THEN
            v_unit_weight := v_packaging.net_weight_kg;
        ELSE 
            -- Fallback
             v_unit_weight := NULL;
        END IF;

        v_source := 'packaging';
        
        -- Snapshot Metadata
        v_snapshot := jsonb_build_object(
            'source', 'packaging',
            'packaging_id', NEW.packaging_id,
            'pkg_gross_kg', v_packaging.gross_weight_kg,
            'pkg_net_kg', v_packaging.net_weight_kg,
            'calc_unit_weight', v_unit_weight
        );

        -- Total Weight: Unit Weight (Pack Weight) * Quantity of Packs
        IF v_unit_weight IS NOT NULL THEN
            NEW.total_weight_kg := v_unit_weight * NEW.quantity;
        ELSE 
            NEW.total_weight_kg := NULL;
        END IF;
        
    ELSE
        -- Case: No Packaging (Base Unit)
        
        -- Priority: gross_weight_kg_base -> net_weight_kg_base -> base_weight_kg (legacy)
        -- Note: We prioritize Gross for transport weight usually.
        IF v_item.gross_weight_kg_base IS NOT NULL AND v_item.gross_weight_kg_base > 0 THEN
             v_unit_weight := v_item.gross_weight_kg_base;
        ELSIF v_item.net_weight_kg_base IS NOT NULL THEN
             v_unit_weight := v_item.net_weight_kg_base;
        ELSIF v_item.base_weight_kg IS NOT NULL THEN
             v_unit_weight := v_item.base_weight_kg;
        ELSE 
             v_unit_weight := NULL;
        END IF;
        
        v_source := 'product_base';

        v_snapshot := jsonb_build_object(
            'source', 'product_base',
            'item_id', NEW.item_id,
            'base_weight_kg', v_item.base_weight_kg,
            'gross_weight_kg_base', v_item.gross_weight_kg_base,
            'net_weight_kg_base', v_item.net_weight_kg_base,
            'calc_unit_weight', v_unit_weight
        );

        -- Total Weight: unit_weight * qty_base (if exists) or quantity
        IF v_unit_weight IS NOT NULL THEN
            NEW.total_weight_kg := v_unit_weight * COALESCE(NEW.qty_base, NEW.quantity);
        ELSE
            NEW.total_weight_kg := NULL;
        END IF;
    END IF;

    -- Assign Final Values
    NEW.unit_weight_kg := v_unit_weight;
    NEW.weight_source := v_source;
    NEW.weight_snapshot := v_snapshot;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
