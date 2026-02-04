-- P1: Align Storage path contract and company member checks

BEGIN;

-- 1) Ensure helper uses auth_user_id via is_member_of and accepts current path contract
CREATE OR REPLACE FUNCTION public.is_company_member_for_path(storage_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    path_company_id uuid;
BEGIN
    -- Current contract: companies/{company_id}/...
    IF storage_path ~ '^companies/[a-f0-9\-]{36}/' THEN
        path_company_id := (regexp_match(storage_path, '^companies/([a-f0-9\-]{36})/'))[1]::uuid;
    -- Legacy contract: {company_id}/...
    ELSIF storage_path ~ '^[a-f0-9\-]{36}/' THEN
        path_company_id := (regexp_match(storage_path, '^([a-f0-9\-]{36})/'))[1]::uuid;
    ELSE
        RETURN false;
    END IF;

    RETURN public.is_member_of(path_company_id);
END;
$$;

-- 2) Remove legacy policies that assume a different folder contract
DROP POLICY IF EXISTS "Allow authenticated upload to company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read from company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from company folder" ON storage.objects;

DROP POLICY IF EXISTS "Users can upload to their company folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their company files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their company files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their company files" ON storage.objects;

-- 3) Standardized policies for company-assets bucket
CREATE POLICY "Company assets: insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'company-assets'
        AND public.is_company_member_for_path(name)
    );

CREATE POLICY "Company assets: select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'company-assets'
        AND public.is_company_member_for_path(name)
    );

CREATE POLICY "Company assets: update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'company-assets'
        AND public.is_company_member_for_path(name)
    )
    WITH CHECK (
        bucket_id = 'company-assets'
        AND public.is_company_member_for_path(name)
    );

CREATE POLICY "Company assets: delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'company-assets'
        AND public.is_company_member_for_path(name)
    );

COMMIT;
