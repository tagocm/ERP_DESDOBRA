-- Migration: Ensure All Item Columns
-- Description: Adds missing columns to items table: height_base, width_base, length_base, line, image_url, category_id.

DO $$
BEGIN
    -- 1. height_base
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'height_base') THEN
        ALTER TABLE public.items ADD COLUMN height_base NUMERIC;
    END IF;

    -- 2. width_base
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'width_base') THEN
        ALTER TABLE public.items ADD COLUMN width_base NUMERIC;
    END IF;

    -- 3. length_base
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'length_base') THEN
        ALTER TABLE public.items ADD COLUMN length_base NUMERIC;
    END IF;

    -- 4. line (Deprecated but used in UI)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'line') THEN
        ALTER TABLE public.items ADD COLUMN line TEXT;
    END IF;

    -- 5. image_url
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'image_url') THEN
        ALTER TABLE public.items ADD COLUMN image_url TEXT;
    END IF;

    -- 6. category_id (Foreign Key to product_categories)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'category_id') THEN
        ALTER TABLE public.items ADD COLUMN category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS items_category_id_idx ON public.items(category_id);
    END IF;

END $$;

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
