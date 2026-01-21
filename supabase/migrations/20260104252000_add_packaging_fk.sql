-- Migration: Add Packaging FK to Sales Document Items
-- Description: Ensures packaging_id has proper foreign key to item_packaging

DO $$
BEGIN
    -- First ensure packaging_id column exists
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'sales_document_items' 
                  AND column_name = 'packaging_id') THEN
        ALTER TABLE public.sales_document_items ADD COLUMN packaging_id UUID;
    END IF;

    -- Add FK constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                  WHERE conname = 'sales_document_items_packaging_id_fkey') THEN
        ALTER TABLE public.sales_document_items 
        ADD CONSTRAINT sales_document_items_packaging_id_fkey 
        FOREIGN KEY (packaging_id) REFERENCES public.item_packaging(id) ON DELETE SET NULL;
    END IF;

END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
