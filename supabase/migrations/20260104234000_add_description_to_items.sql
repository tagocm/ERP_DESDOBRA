-- Migration: Add Description Column to Items
-- Description: Adds 'description' column to items table if it does not exist.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'description'
    ) THEN
        ALTER TABLE public.items ADD COLUMN description TEXT;
    END IF;
END $$;

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
