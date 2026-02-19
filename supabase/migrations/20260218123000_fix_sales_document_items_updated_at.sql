-- Fix: sales_document_items can miss updated_at in older schema path.
-- This breaks generic BEFORE UPDATE trigger update_updated_at_column()
-- with: record "new" has no field "updated_at".

ALTER TABLE public.sales_document_items
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill for rows created before this column existed.
UPDATE public.sales_document_items
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE public.sales_document_items
ALTER COLUMN updated_at SET DEFAULT now();

-- Ensure trigger exists and points to the shared function.
DROP TRIGGER IF EXISTS update_sales_items_updated_at ON public.sales_document_items;
CREATE TRIGGER update_sales_items_updated_at
    BEFORE UPDATE ON public.sales_document_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

