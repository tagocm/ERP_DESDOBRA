-- Harden RLS: CFOP reference tables
--
-- Goal:
-- - Keep CFOP/CFOPS readable for authenticated users that belong to at least one company.
-- - Avoid permissive `USING (true)` policies flagged by static audits.

ALTER TABLE public.cfop ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cfops ENABLE ROW LEVEL SECURITY;

-- Drop permissive read-all policies (if present)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cfop;
DROP POLICY IF EXISTS "cfops_global_read" ON public.cfops;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cfops;

-- Replace with membership-gated read policy
DROP POLICY IF EXISTS "cfop_read_auth" ON public.cfop;
CREATE POLICY "cfop_read_auth"
    ON public.cfop
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "cfops_read_auth" ON public.cfops;
CREATE POLICY "cfops_read_auth"
    ON public.cfops
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
        )
    );

