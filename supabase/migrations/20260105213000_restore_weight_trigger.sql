
-- Migration: Restore Weight Calculation Trigger
-- Description: Ensures the trigger 'trigger_update_weights' exists on 'sales_document_items' 
-- and calls the robust function 'compute_sales_document_item_weight'.

DROP TRIGGER IF EXISTS trigger_update_weights ON sales_document_items;

CREATE TRIGGER trigger_update_weights
    BEFORE INSERT OR UPDATE ON sales_document_items
    FOR EACH ROW
    EXECUTE FUNCTION compute_sales_document_item_weight();

-- Also ensure 'trigger_update_gross_weight' (which updates the parent doc) is fired AFTER the item weight is calc'd.
-- Triggers fire in alphabetical order if timing is same? No, usually definition order but "BEFORE" vs "AFTER" matters.
-- compute_sales_document_item_weight MUST be BEFORE (to set item weight).
-- update_sales_document_weights (gross) MUST be AFTER (to sum up items).

-- Let's check update_sales_document_weights definition just in case.
-- It was 'AFTER INSERT OR UPDATE OR DELETE'. Perfect.

NOTIFY pgrst, 'reload schema';
