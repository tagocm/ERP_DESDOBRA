-- Restore missing sales item weight trigger and backfill null item weights.
-- Context:
-- In some environments the trigger `trigger_update_weights` was missing,
-- leaving `sales_document_items.unit_weight_kg` / `total_weight_kg` as NULL.
-- Route cards then show 0kg because `sales_documents.total_weight_kg` aggregates NULL as 0.

BEGIN;

-- Ensure trigger exists and is attached to the canonical function.
DROP TRIGGER IF EXISTS trigger_update_weights ON public.sales_document_items;
CREATE TRIGGER trigger_update_weights
    BEFORE INSERT OR UPDATE ON public.sales_document_items
    FOR EACH ROW
    EXECUTE FUNCTION public.compute_sales_document_item_weight();

-- Recompute item weights for rows that are currently null.
UPDATE public.sales_document_items
SET quantity = quantity
WHERE unit_weight_kg IS NULL
   OR total_weight_kg IS NULL;

COMMIT;
