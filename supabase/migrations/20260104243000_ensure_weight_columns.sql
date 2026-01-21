-- Migration: Ensure Item Weight Columns (Grams)
-- Description: Ensures net_weight_g_base and gross_weight_g_base exist in items table.

DO $$
BEGIN
    -- 1. net_weight_g_base
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'net_weight_g_base') THEN
        ALTER TABLE public.items ADD COLUMN net_weight_g_base NUMERIC DEFAULT 0;
    END IF;

    -- 2. gross_weight_g_base
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'gross_weight_g_base') THEN
        ALTER TABLE public.items ADD COLUMN gross_weight_g_base NUMERIC DEFAULT 0;
    END IF;

END $$;

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
