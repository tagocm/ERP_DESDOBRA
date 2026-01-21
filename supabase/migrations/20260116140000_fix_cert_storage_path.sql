-- Ensure cert_a1_storage_path exists in company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS cert_a1_storage_path TEXT;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
