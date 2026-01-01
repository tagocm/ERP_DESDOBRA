
-- 1. Add weight columns to sales_document_items
ALTER TABLE public.sales_document_items
ADD COLUMN IF NOT EXISTS unit_weight_kg NUMERIC(15,6), 
ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(15,6),
ADD COLUMN IF NOT EXISTS weight_source TEXT CHECK (weight_source IN ('product_base', 'packaging', 'manual')),
ADD COLUMN IF NOT EXISTS weight_snapshot JSONB,
ADD COLUMN IF NOT EXISTS manual_weight_override BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.sales_document_items.weight_source IS 'Source of the weight calculation: product_base, packaging, or manual';

-- 2. Create function to compute item weight (snapshot strategy)
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
        
        -- Use Packaging Gross -> Net
        IF v_packaging.gross_weight_g IS NOT NULL THEN
            v_unit_weight := v_packaging.gross_weight_g / 1000.0;
        ELSIF v_packaging.net_weight_g IS NOT NULL THEN
            v_unit_weight := v_packaging.net_weight_g / 1000.0;
        ELSE 
            -- Fallback / Null if empty packaging weight
             v_unit_weight := NULL;
        END IF;

        v_source := 'packaging';
        
        -- Snapshot Metadata
        v_snapshot := jsonb_build_object(
            'source', 'packaging',
            'packaging_id', NEW.packaging_id,
            'pkg_gross_g', v_packaging.gross_weight_g,
            'pkg_net_g', v_packaging.net_weight_g,
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
        
        -- Priority: base_weight_kg -> gross_weight/1000 -> net_weight/1000
        IF v_item.base_weight_kg IS NOT NULL THEN
            v_unit_weight := v_item.base_weight_kg;
        ELSIF v_item.gross_weight_g_base IS NOT NULL THEN
            v_unit_weight := v_item.gross_weight_g_base / 1000.0;
        ELSIF v_item.net_weight_g_base IS NOT NULL THEN
            v_unit_weight := v_item.net_weight_g_base / 1000.0;
        ELSE 
             v_unit_weight := NULL;
        END IF;
        
        v_source := 'product_base';

        v_snapshot := jsonb_build_object(
            'source', 'product_base',
            'item_id', NEW.item_id,
            'base_weight_kg', v_item.base_weight_kg,
            'gross_weight_g_base', v_item.gross_weight_g_base,
            'net_weight_g_base', v_item.net_weight_g_base,
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

-- 3. Trigger on Item (Before Insert/Update)
DROP TRIGGER IF EXISTS trg_compute_sales_item_weight ON public.sales_document_items;
CREATE TRIGGER trg_compute_sales_item_weight
BEFORE INSERT OR UPDATE OF quantity, qty_base, packaging_id, item_id, manual_weight_override
ON public.sales_document_items
FOR EACH ROW
EXECUTE FUNCTION public.compute_sales_document_item_weight();


-- 4. Update Order Weight (Sum of Items) - Option B (Delta)
CREATE OR REPLACE FUNCTION public.update_sales_order_total_weight() RETURNS TRIGGER AS $$
DECLARE
    v_delta numeric := 0;
    v_doc_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_delta := COALESCE(NEW.total_weight_kg, 0);
        v_doc_id := NEW.document_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_delta := COALESCE(NEW.total_weight_kg, 0) - COALESCE(OLD.total_weight_kg, 0);
        v_doc_id := NEW.document_id;
    ELSIF TG_OP = 'DELETE' THEN
        v_delta := -COALESCE(OLD.total_weight_kg, 0);
        v_doc_id := OLD.document_id;
    END IF;

    UPDATE public.sales_documents
    SET total_weight_kg = COALESCE(total_weight_kg, 0) + v_delta
    WHERE id = v_doc_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Replace the old trigger "update_sales_order_weight"
DROP TRIGGER IF EXISTS update_sales_order_weight ON public.sales_document_items;

CREATE TRIGGER update_sales_order_total_weight_delta
AFTER INSERT OR UPDATE OR DELETE ON public.sales_document_items
FOR EACH ROW
EXECUTE FUNCTION public.update_sales_order_total_weight();

-- 5. Validation Trigger (Confirm Order)
CREATE OR REPLACE FUNCTION public.validate_sales_order_confirmation() RETURNS TRIGGER AS $$
DECLARE
    v_invalid_count integer;
BEGIN
    -- Check when leaving Draft
    IF OLD.status_commercial = 'draft' AND NEW.status_commercial != 'draft' THEN
        
        SELECT COUNT(*) INTO v_invalid_count
        FROM public.sales_document_items
        WHERE document_id = NEW.id
        AND total_weight_kg IS NULL;
        
        IF v_invalid_count > 0 THEN
            RAISE EXCEPTION 'Não é possível confirmar: existem items sem peso cadastrado (produto/embalagem).';
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_order_confirmation ON public.sales_documents;
CREATE TRIGGER trg_validate_order_confirmation
BEFORE UPDATE OF status_commercial ON public.sales_documents
FOR EACH ROW
EXECUTE FUNCTION public.validate_sales_order_confirmation();

-- 6. Cleanup old function
DROP FUNCTION IF EXISTS public.calculate_sales_order_weight(uuid);
DROP FUNCTION IF EXISTS public.trg_update_sales_order_weight();

-- 7. Init/Data Migration
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Force recalculate item weights (Trigger BEFORE UPDATE)
    FOR r IN SELECT id FROM public.sales_document_items LOOP
        UPDATE public.sales_document_items SET quantity = quantity WHERE id = r.id; 
    END LOOP;
    
    -- Reset Doc Totals
    UPDATE public.sales_documents sd
    SET total_weight_kg = (
        SELECT COALESCE(SUM(total_weight_kg), 0)
        FROM public.sales_document_items sdi
        WHERE sdi.document_id = sd.id
    );
END $$;
