-- Enforce Data Integrity for Item Packaging
-- Migration: 20260106191000_enforce_packaging_integrity.sql

DO $$
BEGIN
    -- 1. Clean up orphaned packaging_ids (set to NULL if referenced packaging doesn't exist)
    UPDATE public.sales_document_items sdi
    SET packaging_id = NULL
    WHERE packaging_id IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM public.item_packaging ip WHERE ip.id = sdi.packaging_id
    );

    -- 2. Drop existing constraint if it exists (to ensure we standardise it)
    -- Try standard name
    ALTER TABLE public.sales_document_items 
    DROP CONSTRAINT IF EXISTS sales_document_items_packaging_id_fkey;
    
    -- Try auto-generated name just in case (optional, but good practice if known)

    -- 3. Add Strict Constraint (RESTRICT delete)
    -- This prevents deleting a Packaging Unit if it is used in any Order.
    -- Users must remove the item from orders before deleting the packaging configuration.
    ALTER TABLE public.sales_document_items
    ADD CONSTRAINT sales_document_items_packaging_id_fkey
    FOREIGN KEY (packaging_id) 
    REFERENCES public.item_packaging(id) 
    ON DELETE RESTRICT;

END $$;
