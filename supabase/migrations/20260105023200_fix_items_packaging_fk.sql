-- Fix missing foreign key relationship on items table
-- This resolves: "Could not find a relationship between 'items' and 'item_packaging'"

BEGIN;

-- Ensure items table has packaging_id column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'items' 
                  AND column_name = 'packaging_id') THEN
        ALTER TABLE public.items ADD COLUMN packaging_id UUID;
    END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                  WHERE conname = 'items_packaging_id_fkey') THEN
        ALTER TABLE public.items 
        ADD CONSTRAINT items_packaging_id_fkey 
        FOREIGN KEY (packaging_id) REFERENCES public.item_packaging(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_items_packaging ON public.items(packaging_id);

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;
