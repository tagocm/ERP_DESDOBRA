ALTER TABLE public.item_production_profiles
    ADD COLUMN IF NOT EXISTS default_sector_id UUID REFERENCES public.production_sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS item_production_profiles_company_default_sector_idx
    ON public.item_production_profiles (company_id, default_sector_id);
