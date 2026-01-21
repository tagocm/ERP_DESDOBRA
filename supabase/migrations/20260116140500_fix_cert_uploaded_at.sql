-- Ensure cert_a1_uploaded_at exists in company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS cert_a1_uploaded_at TIMESTAMPTZ;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
