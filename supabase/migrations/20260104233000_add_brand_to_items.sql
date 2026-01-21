-- Migration: Add Brand Column to Items
-- Description: Adds 'brand' column to items table if it does not exist.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'brand'
    ) THEN
        ALTER TABLE public.items ADD COLUMN brand TEXT;
    END IF;
END $$;

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
