-- Ensure cert_password_encrypted and is_cert_password_saved exist
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS cert_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS is_cert_password_saved BOOLEAN DEFAULT FALSE;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
