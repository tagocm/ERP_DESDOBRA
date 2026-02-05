-- Harden RLS: system preferences (global) tables
--
-- Goal:
-- - Keep system preferences readable to authenticated users.
-- - Restrict writes to admin users only (based on company_members.role = 'admin').
-- - Remove permissive `USING (true)` / `WITH CHECK (true)` policies.

-- Helper predicate: "any membership" (auth user is linked to at least one company)
-- Note: company_members already has RLS limiting SELECT to the current user, so this is safe.

-- ---------------------------------------------------------------------
-- system_occurrence_types
-- ---------------------------------------------------------------------
ALTER TABLE public.system_occurrence_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.system_occurrence_types;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.system_occurrence_types;
DROP POLICY IF EXISTS "system_occurrence_types_read" ON public.system_occurrence_types;
DROP POLICY IF EXISTS "system_occurrence_types_admin_write" ON public.system_occurrence_types;

CREATE POLICY "system_occurrence_types_read"
    ON public.system_occurrence_types
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "system_occurrence_types_admin_write"
    ON public.system_occurrence_types
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
              AND cm.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
              AND cm.role = 'admin'
        )
    );

-- ---------------------------------------------------------------------
-- system_occurrence_reasons
-- ---------------------------------------------------------------------
ALTER TABLE public.system_occurrence_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.system_occurrence_reasons;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.system_occurrence_reasons;
DROP POLICY IF EXISTS "system_occurrence_reasons_read" ON public.system_occurrence_reasons;
DROP POLICY IF EXISTS "system_occurrence_reasons_admin_write" ON public.system_occurrence_reasons;

CREATE POLICY "system_occurrence_reasons_read"
    ON public.system_occurrence_reasons
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "system_occurrence_reasons_admin_write"
    ON public.system_occurrence_reasons
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
              AND cm.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
              AND cm.role = 'admin'
        )
    );

-- ---------------------------------------------------------------------
-- system_occurrence_reason_defaults
-- ---------------------------------------------------------------------
ALTER TABLE public.system_occurrence_reason_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.system_occurrence_reason_defaults;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.system_occurrence_reason_defaults;
DROP POLICY IF EXISTS "system_occurrence_reason_defaults_read" ON public.system_occurrence_reason_defaults;
DROP POLICY IF EXISTS "system_occurrence_reason_defaults_admin_write" ON public.system_occurrence_reason_defaults;

CREATE POLICY "system_occurrence_reason_defaults_read"
    ON public.system_occurrence_reason_defaults
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "system_occurrence_reason_defaults_admin_write"
    ON public.system_occurrence_reason_defaults
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
              AND cm.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
              AND cm.role = 'admin'
        )
    );

