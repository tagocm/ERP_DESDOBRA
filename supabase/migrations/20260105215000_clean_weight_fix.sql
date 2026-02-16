
-- Migration: Fix Weight Calculation Trigger - Final Clean Sweep
-- Description: Ensures columns exist, recreates function to match current schema, and resets trigger.

BEGIN;

-- 1. Ensure Columns Exist (Idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_document_items' AND column_name = 'total_weight_kg') THEN
        ALTER TABLE sales_document_items ADD COLUMN total_weight_kg NUMERIC(15,3) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_document_items' AND column_name = 'unit_weight_kg') THEN
        ALTER TABLE sales_document_items ADD COLUMN unit_weight_kg NUMERIC(15,3) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_document_items' AND column_name = 'weight_snapshot') THEN
        ALTER TABLE sales_document_items ADD COLUMN weight_snapshot JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_document_items' AND column_name = 'weight_source') THEN
        ALTER TABLE sales_document_items ADD COLUMN weight_source TEXT;
    END IF;
    
    -- Check for manual_weight_override. If it doesn't exist, we will NOT use it in the function.
    -- (We don't add it here to avoid changing schema logic unless necessary)
END $$;

-- 2. Drop Trigger and Function to clear cache
-- Drop problematic weight calculation function (and its triggers)
DROP FUNCTION IF EXISTS compute_sales_document_item_weight() CASCADE;

-- 3. Recreate Function (Safe Version)
CREATE OR REPLACE FUNCTION public.compute_sales_document_item_weight() RETURNS TRIGGER AS $$
DECLARE
    v_gross_g numeric;
    v_net_g numeric;
    v_unit_weight numeric;
    v_packaging RECORD;
    v_item RECORD;
    v_source text;
    v_snapshot jsonb;
    v_has_override boolean := false;
BEGIN
    -- Check if manual_weight_override column exists dyanmically? No, costly.
    -- We assume it DOES NOT exist based on previous error. 
    -- If we really need it, we should have added it above.
    -- For now, we skip the override check or implement it only if we Add column above.
    -- Let's ADD the column to be safe and support the feature if planned.
    -- ALTER TABLE sales_document_items ADD COLUMN IF NOT EXISTS manual_weight_override BOOLEAN DEFAULT FALSE;
    -- But since I cannot easily ALTER in a function, I will assume it DOES NOT EXIST and remove logic.
    
    -- Fetch Item Base Info
    SELECT * INTO v_item FROM public.items WHERE id = NEW.item_id;
    
    -- Safety check for item
    IF v_item IS NULL THEN
        RETURN NEW; -- Should not happen due to FK
    END IF;

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
            NEW.total_weight_kg := v_unit_weight * COALESCE(NEW.quantity, 0);
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

        IF v_unit_weight IS NOT NULL THEN
            -- Use COALESCE(qty_base, quantity) priority
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

-- 4. Recreate Trigger
CREATE TRIGGER trigger_update_weights
    BEFORE INSERT OR UPDATE ON sales_document_items
    FOR EACH ROW
    EXECUTE FUNCTION compute_sales_document_item_weight();

-- 5. Force Schema Reload
NOTIFY pgrst, 'reload schema';

COMMIT;
