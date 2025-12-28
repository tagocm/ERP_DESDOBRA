-- Migration: Company Assets Management (Logo + Certificate A1)
-- Description: Creates company_settings table, Storage bucket, and security policies

-- ============================================================================
-- 1. Create company_settings table (if not exists) and add columns
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_settings (
    company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add columns if they don't exist
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS logo_path text NULL,
ADD COLUMN IF NOT EXISTS cert_a1_storage_path text NULL,
ADD COLUMN IF NOT EXISTS cert_a1_uploaded_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS cert_a1_expires_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS is_cert_password_saved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cert_password_encrypted text NULL;

-- Add comments
COMMENT ON TABLE public.company_settings IS 'Company-specific settings including logo and certificate A1 management';
COMMENT ON COLUMN public.company_settings.cert_password_encrypted IS 'Encrypted password for A1 Certificate (simple encryption for demo/MVP)';

-- ============================================================================
-- 2. Create updated_at trigger for company_settings
-- ============================================================================

CREATE TRIGGER set_company_settings_updated_at
    BEFORE UPDATE ON public.company_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. Enable RLS on company_settings
-- ============================================================================

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Create RLS policies for company_settings
-- ============================================================================

-- Policy: Users can view settings for companies they are members of
DROP POLICY IF EXISTS "Users can view their company settings" ON public.company_settings;
CREATE POLICY "Users can view their company settings"
    ON public.company_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = company_settings.company_id
            AND cm.auth_user_id = auth.uid()
        )
    );

-- Policy: Users can insert settings for companies they are members of
DROP POLICY IF EXISTS "Users can insert their company settings" ON public.company_settings;
CREATE POLICY "Users can insert their company settings"
    ON public.company_settings
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = company_settings.company_id
            AND cm.auth_user_id = auth.uid()
        )
    );

-- Policy: Users can update settings for companies they are members of
DROP POLICY IF EXISTS "Users can update their company settings" ON public.company_settings;
CREATE POLICY "Users can update their company settings"
    ON public.company_settings
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = company_settings.company_id
            AND cm.auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = company_settings.company_id
            AND cm.auth_user_id = auth.uid()
        )
    );

-- Policy: Users can delete settings for companies they are members of
DROP POLICY IF EXISTS "Users can delete their company settings" ON public.company_settings;
CREATE POLICY "Users can delete their company settings"
    ON public.company_settings
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = company_settings.company_id
            AND cm.auth_user_id = auth.uid()
        )
    );

-- ============================================================================
-- 5. Create Storage bucket for company assets
-- ============================================================================

-- Insert bucket if not exists (Supabase Storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'company-assets',
    'company-assets',
    false, -- PRIVATE bucket
    10485760, -- 10MB limit
    ARRAY[
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/svg+xml',
        'image/webp',
        'application/x-pkcs12', -- .pfx/.p12 certificates
        'application/pkcs12'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. Create helper function for Storage policies
-- ============================================================================

-- Function to check if user is member of company based on storage path
CREATE OR REPLACE FUNCTION public.is_company_member_for_path(storage_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    path_company_id uuid;
BEGIN
    -- Extract company_id from path: companies/{company_id}/...
    -- Example: companies/123e4567-e89b-12d3-a456-426614174000/logo/file.png
    
    IF storage_path ~ '^companies/[a-f0-9\-]{36}/' THEN
        path_company_id := (regexp_match(storage_path, '^companies/([a-f0-9\-]{36})/'))[1]::uuid;
        
        -- Check if current user is member of this company
        RETURN EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = path_company_id
            AND cm.user_id = auth.uid()
        );
    END IF;
    
    RETURN false;
END;
$$;

-- ============================================================================
-- 7. Create Storage policies for company-assets bucket
-- ============================================================================

-- Policy: Users can upload files to their company's folder
DROP POLICY IF EXISTS "Users can upload to their company folder" ON storage.objects;
CREATE POLICY "Users can upload to their company folder"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'company-assets'
        AND public.is_company_member_for_path(name)
    );

-- Policy: Users can view files from their company's folder
DROP POLICY IF EXISTS "Users can view their company files" ON storage.objects;
CREATE POLICY "Users can view their company files"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'company-assets'
        AND public.is_company_member_for_path(name)
    );

-- Policy: Users can update files in their company's folder
DROP POLICY IF EXISTS "Users can update their company files" ON storage.objects;
CREATE POLICY "Users can update their company files"
    ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'company-assets'
        AND public.is_company_member_for_path(name)
    )
    WITH CHECK (
        bucket_id = 'company-assets'
        AND public.is_company_member_for_path(name)
    );

-- Policy: Users can delete files from their company's folder
DROP POLICY IF EXISTS "Users can delete their company files" ON storage.objects;
CREATE POLICY "Users can delete their company files"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'company-assets'
        AND public.is_company_member_for_path(name)
    );

-- ============================================================================
-- 8. Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_company_settings_company_id 
    ON public.company_settings(company_id);

-- ============================================================================
-- Done!
-- ============================================================================
