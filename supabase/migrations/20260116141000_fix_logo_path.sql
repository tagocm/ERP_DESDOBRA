-- Ensure logo_path exists in company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS logo_path TEXT;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
