
-- Create table for extended company settings
CREATE TABLE IF NOT EXISTS public.company_settings (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    
    -- Identification
    legal_name TEXT,
    trade_name TEXT,
    cnpj TEXT,
    ie TEXT,
    im TEXT,
    cnae TEXT,
    
    -- Contact & Branding
    phone TEXT,
    email TEXT,
    website TEXT,
    logo_path TEXT, -- Path in Storage
    
    -- Address
    address_zip TEXT,
    address_street TEXT,
    address_number TEXT,
    address_complement TEXT,
    address_neighborhood TEXT,
    address_city TEXT,
    address_state TEXT,
    address_country TEXT DEFAULT 'Brasil',
    
    -- Fiscal / Tax
    tax_regime TEXT CHECK (tax_regime IN ('simples_nacional', 'lucro_presumido', 'lucro_real')),
    
    -- NF-e Configuration
    nfe_environment TEXT CHECK (nfe_environment IN ('homologation', 'production')),
    nfe_series TEXT,
    nfe_next_number INTEGER DEFAULT 1,
    
    -- Certificate A1 (Secure Storage)
    cert_a1_storage_path TEXT, -- Path in PRIVATE bucket
    cert_a1_uploaded_at TIMESTAMPTZ,
    cert_a1_expires_at TIMESTAMPTZ,
    
    -- Meta
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read settings" ON public.company_settings
    FOR SELECT TO authenticated USING (is_member_of(company_id));

CREATE POLICY "Tenant update settings" ON public.company_settings
    FOR UPDATE TO authenticated USING (is_member_of(company_id)) WITH CHECK (is_member_of(company_id));

CREATE POLICY "Tenant insert settings" ON public.company_settings
    FOR INSERT TO authenticated WITH CHECK (is_member_of(company_id));

-- Storage Bucket Creation (Idempotent attempt)
-- Note: 'storage' schema might not be available in migrations for some setups, 
-- but usually fits for Supabase projects.
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
    VALUES ('company-assets', 'company-assets', false, false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/x-pkcs12'])
    ON CONFLICT (id) DO NOTHING;
END $$;

-- Storage Rules (RLS for Objects)
-- We need to ensure users can only access files belonging to their company.
-- Standard pattern: Folder structure {company_id}/{file} or checking metadata.
-- Here we rely on path naming convention: company_id/filename

CREATE POLICY "Allow authenticated upload to company folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'company-assets' AND
    (storage.foldername(name))[1]::uuid IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Allow authenticated read from company folder"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'company-assets' AND
    (storage.foldername(name))[1]::uuid IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Allow authenticated update to company folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'company-assets' AND
    (storage.foldername(name))[1]::uuid IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Allow authenticated delete from company folder"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'company-assets' AND
    (storage.foldername(name))[1]::uuid IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    )
);
