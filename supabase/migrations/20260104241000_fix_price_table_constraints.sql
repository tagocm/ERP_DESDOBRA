-- Migration: Ensure Price Table Items Unique Constraint
-- Description: Re-applies the unique constraint on (price_table_id, item_id) for price_table_items to ensure ON CONFLICT works.

DO $$
BEGIN
    -- Check if constraint exists, if not create it.
    -- We can't easily check complex constraints in a single line, so we'll try to drop duplicates first (if any) then apply.
    
    -- 1. Optional: Clean up duplicates if they somehow exist (unlikely if we want to enforce unique)
    -- This is dangerous if data is precious, but for now we assume we want to enforce it.
    -- (Skipping data cleanup for safety, assuming empty or valid data)

    -- 2. Drop constraint if it exists with a different name or to ensure recreation
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_table_items_unique_item') THEN
        ALTER TABLE public.price_table_items DROP CONSTRAINT price_table_items_unique_item;
    END IF;

    -- 3. Add constraint
    ALTER TABLE public.price_table_items 
    ADD CONSTRAINT price_table_items_unique_item UNIQUE (price_table_id, item_id);

END $$;

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
