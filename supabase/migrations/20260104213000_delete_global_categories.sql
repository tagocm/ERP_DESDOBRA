-- Migration: Delete Global Categories
-- Description: Deletes all product categories that are global (company_id IS NULL).
-- IMPORTANT: Any items using these categories will have their category_id set to NULL due to the foreign key constraint.

DELETE FROM public.product_categories 
WHERE company_id IS NULL;
