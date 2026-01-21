-- Migration: Change Weight Unit to KG (Safe Mode)
-- Description: Adds KG columns and removes G columns if they exist. Skips data conversion if G columns are missing.

-- 1. Items Table
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS net_weight_kg_base numeric DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS gross_weight_kg_base numeric DEFAULT 0;

-- Attempt conversion only if column exists (Dynamic SQL)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'net_weight_g_base') THEN
        EXECUTE 'UPDATE public.items SET net_weight_kg_base = COALESCE(net_weight_g_base, 0) / 1000.0 WHERE net_weight_kg_base = 0';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'gross_weight_g_base') THEN
        EXECUTE 'UPDATE public.items SET gross_weight_kg_base = COALESCE(gross_weight_g_base, 0) / 1000.0 WHERE gross_weight_kg_base = 0';
    END IF;
END $$;

-- Drop old columns safely
ALTER TABLE public.items DROP COLUMN IF EXISTS net_weight_g_base;
ALTER TABLE public.items DROP COLUMN IF EXISTS gross_weight_g_base;


-- 2. Item Packaging Table
ALTER TABLE public.item_packaging ADD COLUMN IF NOT EXISTS net_weight_kg numeric DEFAULT 0;
ALTER TABLE public.item_packaging ADD COLUMN IF NOT EXISTS gross_weight_kg numeric DEFAULT 0;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'item_packaging' AND column_name = 'net_weight_g') THEN
         EXECUTE 'UPDATE public.item_packaging SET net_weight_kg = COALESCE(net_weight_g, 0) / 1000.0 WHERE net_weight_kg = 0';
    END IF;

    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'item_packaging' AND column_name = 'gross_weight_g') THEN
         EXECUTE 'UPDATE public.item_packaging SET gross_weight_kg = COALESCE(gross_weight_g, 0) / 1000.0 WHERE gross_weight_kg = 0';
    END IF;
END $$;

ALTER TABLE public.item_packaging DROP COLUMN IF EXISTS net_weight_g;
ALTER TABLE public.item_packaging DROP COLUMN IF EXISTS gross_weight_g;

-- Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
