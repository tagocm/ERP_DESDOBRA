-- Purpose: allow authenticated users to create a company + become admin WITHOUT exposing service-role in user flows.
-- Security model:
-- - SECURITY DEFINER function owned by migration role (postgres)
-- - Ignores any user-supplied company_id; always uses auth.uid()
-- - Caller must be authenticated; function grants EXECUTE to authenticated only

BEGIN;

CREATE OR REPLACE FUNCTION public.onboard_create_company(_company_name text, _slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_company_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING errcode = '28000';
    END IF;

    IF _company_name IS NULL OR length(trim(_company_name)) = 0 THEN
        RAISE EXCEPTION 'Company name is required' USING errcode = '22023';
    END IF;

    IF _slug IS NULL OR length(trim(_slug)) = 0 THEN
        RAISE EXCEPTION 'Slug is required' USING errcode = '22023';
    END IF;

    -- Insert company (unique violation on slug will be handled by caller retries)
    INSERT INTO public.companies (name, slug)
    VALUES (_company_name, _slug)
    RETURNING id INTO new_company_id;

    -- Create membership (admin)
    INSERT INTO public.company_members (company_id, auth_user_id, role)
    VALUES (new_company_id, auth.uid(), 'admin');

    RETURN new_company_id;
EXCEPTION
    WHEN unique_violation THEN
        -- Slug conflict: return NULL and let the caller retry with a new slug
        RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.onboard_create_company(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.onboard_create_company(text, text) TO authenticated;

COMMIT;

