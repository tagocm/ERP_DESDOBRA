-- Ensure database schema alignment and force schema cache reload

-- 1. Ensure columns exist (just in case)
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS cert_a1_expires_at timestamptz NULL;

-- 2. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
