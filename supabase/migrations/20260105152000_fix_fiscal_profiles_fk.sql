-- Migration: Ensure FK for Item Fiscal Profiles
-- Description: Explicitly recreates the FK linking item_fiscal_profiles to items to satisfy PostgREST relationship detection.

-- 1. Drop existing FK if any
ALTER TABLE public.item_fiscal_profiles DROP CONSTRAINT IF EXISTS item_fiscal_profiles_item_id_fkey;

-- 2. Validate clean data
DELETE FROM public.item_fiscal_profiles WHERE item_id NOT IN (SELECT id FROM public.items);

-- 3. Add Constraint explicitly
ALTER TABLE public.item_fiscal_profiles 
    ADD CONSTRAINT item_fiscal_profiles_item_id_fkey 
    FOREIGN KEY (item_id) 
    REFERENCES public.items(id) 
    ON DELETE CASCADE;

-- 4. Create Index if missing
CREATE INDEX IF NOT EXISTS idx_item_fiscal_profiles_item_id ON public.item_fiscal_profiles(item_id);

-- 5. Force Schema Reload
NOTIFY pgrst, 'reload schema';
