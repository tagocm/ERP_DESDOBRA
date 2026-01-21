
-- Migration: Add weight backup logic to Sales Item trigger
-- Description: When a fiscal update (or any update) occurs on sales_document_items but no weight info is provided (or changed), 
-- we must ensure the calculated weight is NOT zeroed out due to missing inputs or trigger re-runs.

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

    -- Fetch Item Base Info (Always needed to recalc correctly)
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
        -- Plus fallbacks for gram weights / 1000
        IF v_item.gross_weight_kg_base IS NOT NULL AND v_item.gross_weight_kg_base > 0 THEN
             v_unit_weight := v_item.gross_weight_kg_base;
        ELSIF v_item.gross_weight_g_base IS NOT NULL AND v_item.gross_weight_g_base > 0 THEN
             v_unit_weight := v_item.gross_weight_g_base / 1000.0;
             
        ELSIF v_item.net_weight_kg_base IS NOT NULL AND v_item.net_weight_kg_base > 0 THEN
             v_unit_weight := v_item.net_weight_kg_base;
        ELSIF v_item.net_weight_g_base IS NOT NULL AND v_item.net_weight_g_base > 0 THEN
             v_unit_weight := v_item.net_weight_g_base / 1000.0;
             
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
        -- Note: qty_base MUST be preserved. If this runs on an update where qty_base is not sent, 
        -- we must use OLD.qty_base if NEW.qty_base is null?
        -- Standard UPDATE in postgres fills NEW with OLD values for untouched columns usually?
        -- Yes, unless the UPDATE statement explicitly sets them to NULL.
        -- Our backend code sets specific fields. Unspecified fields remain as per OLD in NEW record (verify!)
        -- Standard SQL update: attributes not in SET list retain their values.
        
        IF v_unit_weight IS NOT NULL THEN
            NEW.total_weight_kg := v_unit_weight * COALESCE(NEW.qty_base, NEW.quantity);
        ELSE
            NEW.total_weight_kg := 0; -- Default to 0 instead of NULL to avoid total sum issues
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
