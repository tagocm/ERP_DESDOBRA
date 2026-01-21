-- Migration: Ensure GTIN/EAN Base Column
-- Description: Ensures 'gtin_ean_base' exists in items, handling rename if 'gtin' exists.

DO $$
BEGIN
    -- 1. Check if 'gtin_ean_base' already exists
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'gtin_ean_base'
    ) THEN
        -- 2. Check if 'gtin' exists (legacy name)
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'items' AND column_name = 'gtin'
        ) THEN
            -- Rename mapping
            ALTER TABLE public.items RENAME COLUMN gtin TO gtin_ean_base;
        ELSE
            -- Create new column
            ALTER TABLE public.items ADD COLUMN gtin_ean_base TEXT;
        END IF;
    END IF;
END $$;

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
