-- Migration: Standardize Gross Weight for Logistics
-- Date: 2026-01-06
-- Description: Enforces Gross Weight as the standard for 'unit_weight_kg' and 'total_weight_kg'.
--              Removes heuristics and ensures explicit fallbacks are recorded.

BEGIN;

-- 1. Redefine Item Weight Calculation (Source of Truth)
CREATE OR REPLACE FUNCTION public.compute_sales_document_item_weight() RETURNS TRIGGER AS $$
DECLARE
    v_unit_weight numeric(15,3);
    v_packaging RECORD;
    v_item RECORD;
    v_source text;
    v_snapshot jsonb;
    v_fallback_applied boolean := false;
    v_calc_notes text := '';
BEGIN
    -- Fetch Item Base Info
    SELECT * INTO v_item FROM public.items WHERE id = NEW.item_id;
    
    -- Safety check
    IF v_item IS NULL THEN
        RETURN NEW; 
    END IF;

    -- Decision Logic
    IF NEW.packaging_id IS NOT NULL THEN
        -- Case: Packaging Selected
        SELECT * INTO v_packaging FROM public.item_packaging WHERE id = NEW.packaging_id;
        v_source := 'packaging';
        
        -- Priority 1: Packaging Gross Weight
        IF v_packaging.gross_weight_kg IS NOT NULL AND v_packaging.gross_weight_kg > 0 THEN
            v_unit_weight := v_packaging.gross_weight_kg;
        -- Priority 2: Packaging Net Weight (Fallback)
        ELSIF v_packaging.net_weight_kg IS NOT NULL AND v_packaging.net_weight_kg > 0 THEN
            v_unit_weight := v_packaging.net_weight_kg;
            v_fallback_applied := true;
            v_calc_notes := 'Fallback: Uses Net Weight (Gross not found)';
        ELSE 
             v_unit_weight := 0;
             v_calc_notes := 'Error: No weight found in packaging';
        END IF;

        -- Snapshot Metadata
        v_snapshot := jsonb_build_object(
            'source', 'packaging',
            'packaging_id', NEW.packaging_id,
            'pkg_gross_kg', v_packaging.gross_weight_kg,
            'pkg_net_kg', v_packaging.net_weight_kg,
            'calc_unit_weight', v_unit_weight,
            'fallback_applied', v_fallback_applied,
            'notes', v_calc_notes
        );

        -- Total Weight (Packaging Unit * Qty)
        NEW.total_weight_kg := ROUND((COALESCE(v_unit_weight, 0) * COALESCE(NEW.quantity, 0)), 3);
        
    ELSE
        -- Case: No Packaging (Base Unit)
        v_source := 'product_base';
        
        -- Priority 1: Base Gross KG
        IF v_item.gross_weight_kg_base IS NOT NULL AND v_item.gross_weight_kg_base > 0 THEN
             v_unit_weight := v_item.gross_weight_kg_base;
        -- Priority 2: Base Gross G / 1000
        ELSIF v_item.gross_weight_g_base IS NOT NULL AND v_item.gross_weight_g_base > 0 THEN
             v_unit_weight := v_item.gross_weight_g_base / 1000.0;
        -- Priority 3: Base Net KG (Fallback)
        ELSIF v_item.net_weight_kg_base IS NOT NULL AND v_item.net_weight_kg_base > 0 THEN
             v_unit_weight := v_item.net_weight_kg_base;
             v_fallback_applied := true;
             v_calc_notes := 'Fallback: Uses Base Net KG';
        -- Priority 4: Base Net G / 1000 (Fallback)
        ELSIF v_item.net_weight_g_base IS NOT NULL AND v_item.net_weight_g_base > 0 THEN
             v_unit_weight := v_item.net_weight_g_base / 1000.0;
             v_fallback_applied := true;
             v_calc_notes := 'Fallback: Uses Base Net G';
        ELSE 
             v_unit_weight := 0;
             v_calc_notes := 'Error: No base weight found';
        END IF;
        
        -- Snapshot Metadata
        v_snapshot := jsonb_build_object(
            'source', 'product_base',
            'item_id', NEW.item_id,
            'gross_weight_kg_base', v_item.gross_weight_kg_base,
            'net_weight_kg_base', v_item.net_weight_kg_base,
            'calc_unit_weight', v_unit_weight,
            'fallback_applied', v_fallback_applied,
            'notes', v_calc_notes
        );

        -- Total Weight (Unit * QtyBase or Qty)
        -- Use COALESCE(qty_base, quantity) to support legacy items
        NEW.total_weight_kg := ROUND((COALESCE(v_unit_weight, 0) * COALESCE(NEW.qty_base, NEW.quantity, 0)), 3);
    END IF;

    -- Assign Final Values (Standardized 3 decimal places)
    NEW.unit_weight_kg := ROUND(COALESCE(v_unit_weight, 0), 3);
    NEW.weight_source := v_source;
    NEW.weight_snapshot := v_snapshot;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 2. Redefine Order Totals Calculation (Simple Sum, No Heuristics)
CREATE OR REPLACE FUNCTION update_sales_document_weights()
RETURNS TRIGGER AS $$
DECLARE
    v_document_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_document_id := OLD.document_id;
    ELSE
        v_document_id := NEW.document_id;
    END IF;

    -- Update document totals based purely on items sum
    -- Standardizing: total_gross_weight_kg IS the logistical weight.
    -- total_weight_kg is set equal to gross for now (Logistics View).
    UPDATE sales_documents
    SET 
        total_gross_weight_kg = (
            SELECT COALESCE(SUM(total_weight_kg), 0)
            FROM sales_document_items
            WHERE document_id = v_document_id
        ),
        total_weight_kg = (
            SELECT COALESCE(SUM(total_weight_kg), 0)
            FROM sales_document_items
            WHERE document_id = v_document_id
        )
    WHERE id = v_document_id;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- 3. Ensure Triggers are bound (Idempotent)
DROP TRIGGER IF EXISTS trigger_update_weights ON sales_document_items;
CREATE TRIGGER trigger_update_weights
    BEFORE INSERT OR UPDATE ON sales_document_items
    FOR EACH ROW
    EXECUTE FUNCTION compute_sales_document_item_weight();

DROP TRIGGER IF EXISTS trigger_update_gross_weight ON sales_document_items;
CREATE TRIGGER trigger_update_gross_weight
    AFTER INSERT OR UPDATE OR DELETE ON sales_document_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_document_weights();


-- 4. Backfill/Recalculate All Existing Items
DO $$
DECLARE
    r RECORD;
BEGIN
    -- This update forces the BEFORE trigger to fire for every item
    -- effectively recalculating unit_weight_kg and snapshots.
    FOR r IN SELECT id FROM sales_document_items LOOP
        UPDATE sales_document_items 
        SET quantity = quantity 
        WHERE id = r.id;
    END LOOP;
    
    -- Triggers will handle the document totals automatically.
END $$;

COMMIT;
