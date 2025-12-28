-- Ensure all NF-e and Address related columns exist in company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS city_code_ibge TEXT,
ADD COLUMN IF NOT EXISTS nfe_environment TEXT DEFAULT 'homologation',
ADD COLUMN IF NOT EXISTS nfe_series TEXT,
ADD COLUMN IF NOT EXISTS nfe_next_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS nfe_flags JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS tax_regime TEXT;
