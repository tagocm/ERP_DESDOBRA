-- Migration: Simplify and Enforce Gross Weight Logic
-- Date: 2026-01-06
-- Description: Enforces strict Gross Weight calculation. 
--              Standardizes order total as simple sum of item weights.

BEGIN;

-------------------------------------------------------------------------------
-- 1. ITEM WEIGHT CALCULATION (Source of Truth)
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_sales_document_item_weight() RETURNS TRIGGER AS $$
DECLARE
    v_item RECORD;
    v_pkg RECORD;
    v_unit_weight numeric(15,3) := 0;
    v_source text;
    v_snapshot jsonb;
    v_fallback text := NULL;
BEGIN
    -- Fetch Base Data
    SELECT * INTO v_item FROM public.items WHERE id = NEW.item_id;
    
    IF v_item IS NULL THEN 
        RETURN NEW; -- Should be prevented by FK, but safe exit
    END IF;

    -- A) Packaging Strategy
    IF NEW.packaging_id IS NOT NULL THEN
        SELECT * INTO v_pkg FROM public.item_packaging WHERE id = NEW.packaging_id;
        v_source := 'packaging';

        IF v_pkg.gross_weight_kg IS NOT NULL AND v_pkg.gross_weight_kg > 0 THEN
            v_unit_weight := v_pkg.gross_weight_kg;
        ELSIF v_pkg.net_weight_kg IS NOT NULL AND v_pkg.net_weight_kg > 0 THEN
            v_unit_weight := v_pkg.net_weight_kg;
            v_fallback := 'net_weight_kg';
        ELSE
            -- DYNAMIC CALCULATION FALLBACK
            -- If packaging has no weight, iterate base item weight * qty_in_base
            DECLARE
                v_base_weight numeric := 0;
            BEGIN
                IF v_item.gross_weight_kg_base IS NOT NULL AND v_item.gross_weight_kg_base > 0 THEN
                    v_base_weight := v_item.gross_weight_kg_base;
                ELSIF v_item.gross_weight_g_base IS NOT NULL AND v_item.gross_weight_g_base > 0 THEN
                     v_base_weight := v_item.gross_weight_g_base / 1000.0;
                END IF;

                IF v_base_weight > 0 THEN
                    v_unit_weight := v_base_weight * COALESCE(v_pkg.qty_in_base, 1);
                    v_fallback := 'calculated_from_base';
                ELSE
                    v_unit_weight := 0;
                    v_fallback := 'missing_packaging_and_base_weight';
                END IF;
            END;
        END IF;

        v_snapshot := jsonb_build_object(
            'source', 'packaging',
            'packaging_id', NEW.packaging_id,
            'gross', v_pkg.gross_weight_kg,
            'net', v_pkg.net_weight_kg,
            'used', v_unit_weight,
            'fallback', v_fallback
        );

    -- B) Product Base Strategy
    ELSE
        v_source := 'product_base';

        IF v_item.gross_weight_kg_base IS NOT NULL AND v_item.gross_weight_kg_base > 0 THEN
            v_unit_weight := v_item.gross_weight_kg_base;
        ELSIF v_item.gross_weight_g_base IS NOT NULL AND v_item.gross_weight_g_base > 0 THEN
            v_unit_weight := v_item.gross_weight_g_base / 1000.0;
            v_fallback := 'gross_weight_g_base';
        ELSIF v_item.net_weight_kg_base IS NOT NULL AND v_item.net_weight_kg_base > 0 THEN
            v_unit_weight := v_item.net_weight_kg_base;
            v_fallback := 'net_weight_kg_base';
        ELSIF v_item.net_weight_g_base IS NOT NULL AND v_item.net_weight_g_base > 0 THEN
            v_unit_weight := v_item.net_weight_g_base / 1000.0;
            v_fallback := 'net_weight_g_base';
        ELSE
            v_unit_weight := 0;
            v_fallback := 'missing_base_weight';
        END IF;

        v_snapshot := jsonb_build_object(
            'source', 'product_base',
            'item_id', NEW.item_id,
            'gross_base', v_item.gross_weight_kg_base,
            'net_base', v_item.net_weight_kg_base,
            'used', v_unit_weight,
            'fallback', v_fallback
        );
    END IF;

    -- C) Final Assignments
    NEW.unit_weight_kg := ROUND(v_unit_weight, 3);
    NEW.total_weight_kg := ROUND(NEW.unit_weight_kg * COALESCE(NEW.quantity, 0), 3);
    NEW.weight_source := v_source;
    NEW.weight_snapshot := v_snapshot;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-------------------------------------------------------------------------------
-- 2. ORDER TOTALS CALCULATION (Aggregation)
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_sales_document_weights() RETURNS TRIGGER AS $$
DECLARE
    v_doc_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_doc_id := OLD.document_id;
    ELSE
        v_doc_id := NEW.document_id;
    END IF;

    -- Simple SUM of the lines. No joins, no heuristics.
    UPDATE sales_documents
    SET 
        total_gross_weight_kg = (
            SELECT COALESCE(SUM(total_weight_kg), 0)
            FROM sales_document_items
            WHERE document_id = v_doc_id
        ),
        total_weight_kg = (
            SELECT COALESCE(SUM(total_weight_kg), 0)
            FROM sales_document_items
            WHERE document_id = v_doc_id
        )
    WHERE id = v_doc_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;


-------------------------------------------------------------------------------
-- 3. TRIGGERS
-------------------------------------------------------------------------------
-- Reset Item Trigger
DROP TRIGGER IF EXISTS trigger_update_weights ON sales_document_items;
CREATE TRIGGER trigger_update_weights
    BEFORE INSERT OR UPDATE ON sales_document_items
    FOR EACH ROW
    EXECUTE FUNCTION compute_sales_document_item_weight();

-- Reset Order Trigger (Handles Insert/Update/Delete of items)
DROP TRIGGER IF EXISTS trigger_update_gross_weight ON sales_document_items;
CREATE TRIGGER trigger_update_gross_weight
    AFTER INSERT OR UPDATE OR DELETE ON sales_document_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_document_weights();


-------------------------------------------------------------------------------
-- 4. BACKFILL (Recalculate Everything)
-------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Force trigger execution for all items
    FOR r IN SELECT id FROM sales_document_items LOOP
        UPDATE sales_document_items 
        SET quantity = quantity 
        WHERE id = r.id;
    END LOOP;
END $$;

COMMIT;
