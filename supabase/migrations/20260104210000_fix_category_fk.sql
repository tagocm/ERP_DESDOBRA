-- Migration: Fix Foreign Key for Category/Items relationship
-- Description: Explicitly ensures the FK constraint exists with a standard name for PostgREST detection.

DO $$
BEGIN
    -- Check if column exists, if not add it (safeguard)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'category_id') THEN
        ALTER TABLE public.items ADD COLUMN category_id UUID;
    END IF;

    -- Drop constraint if exists to ensure clean slate with known name
    ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_category_id_fkey;

    -- Re-add constraint
    ALTER TABLE public.items
    ADD CONSTRAINT items_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES public.product_categories(id)
    ON DELETE SET NULL;

END $$;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
