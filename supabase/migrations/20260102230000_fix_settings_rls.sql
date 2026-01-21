-- Fix company_settings RLS and Storage Helper

-- 1. Fix Storage Helper Function (was using user_id instead of auth_user_id)
CREATE OR REPLACE FUNCTION public.is_company_member_for_path(storage_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    path_company_id uuid;
BEGIN
    -- Extract company_id from path: companies/{company_id}/...
    IF storage_path ~ '^companies/[a-f0-9\-]{36}/' THEN
        path_company_id := (regexp_match(storage_path, '^companies/([a-f0-9\-]{36})/'))[1]::uuid;
        
        -- Check if current user is member of this company using the standard helper
        RETURN public.is_member_of(path_company_id);
    END IF;
    
    RETURN false;
END;
$$;

-- 2. Standardize company_settings policies to use is_member_of
DROP POLICY IF EXISTS "Users can view their company settings" ON public.company_settings;
CREATE POLICY "Users can view their company settings"
    ON public.company_settings
    FOR SELECT
    USING (public.is_member_of(company_id));

DROP POLICY IF EXISTS "Users can insert their company settings" ON public.company_settings;
CREATE POLICY "Users can insert their company settings"
    ON public.company_settings
    FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

DROP POLICY IF EXISTS "Users can update their company settings" ON public.company_settings;
CREATE POLICY "Users can update their company settings"
    ON public.company_settings
    FOR UPDATE
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

DROP POLICY IF EXISTS "Users can delete their company settings" ON public.company_settings;
CREATE POLICY "Users can delete their company settings"
    ON public.company_settings
    FOR DELETE
    USING (public.is_member_of(company_id));

-- 3. Ensure RLS is enabled
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
