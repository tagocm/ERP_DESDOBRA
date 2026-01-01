-- Add base_weight_kg to items table
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS base_weight_kg NUMERIC(10,3);

-- Add qty_base to sales_document_items if not exists
ALTER TABLE public.sales_document_items ADD COLUMN IF NOT EXISTS qty_base NUMERIC(15,4);

-- Add total_weight_kg to sales_documents
ALTER TABLE public.sales_documents ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(15,3) DEFAULT 0;

-- Function to calculate weight
CREATE OR REPLACE FUNCTION public.calculate_sales_order_weight(doc_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE public.sales_documents
    SET total_weight_kg = (
        SELECT COALESCE(SUM(
            CASE 
                -- If UOM is kg, weight is just the quantity (assuming qty_base is correct kg amount if present, or quantity is kg)
                WHEN i.uom ILIKE 'kg' THEN COALESCE(sdi.qty_base, sdi.quantity)
                -- Otherwise use base_weight_kg. If null, result is 0 (handled by UI as unknown)
                ELSE COALESCE(sdi.qty_base, sdi.quantity) * COALESCE(i.base_weight_kg, 0)
            END
        ), 0)
        FROM public.sales_document_items sdi
        JOIN public.items i ON i.id = sdi.item_id
        WHERE sdi.document_id = doc_id
    )
    WHERE id = doc_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for items changes
CREATE OR REPLACE FUNCTION public.trg_update_sales_order_weight() RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.calculate_sales_order_weight(COALESCE(NEW.document_id, OLD.document_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS update_sales_order_weight ON public.sales_document_items;
CREATE TRIGGER update_sales_order_weight
AFTER INSERT OR UPDATE OR DELETE ON public.sales_document_items
FOR EACH ROW EXECUTE FUNCTION public.trg_update_sales_order_weight();

-- Recalculate for existing orders (optional, but good for "incremental" to not break existing)
-- DO $$
-- DECLARE
--     r RECORD;
-- BEGIN
--     FOR r IN SELECT id FROM public.sales_documents LOOP
--         PERFORM public.calculate_sales_order_weight(r.id);
--     END LOOP;
-- END $$;
