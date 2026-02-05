-- Harden RLS: deliveries/users + settlement tables
--
-- Why:
-- - Remove permissive "read all" policies that leak cross-tenant data.
-- - Ensure new financial settlement tables are protected by RLS.

-- ---------------------------------------------------------------------
-- Deliveries: remove permissive read-all policies
-- ---------------------------------------------------------------------
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.deliveries;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.delivery_items;

-- ---------------------------------------------------------------------
-- Users: restrict to tenant membership (company_members)
-- ---------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for authenticated" ON public.users;
DROP POLICY IF EXISTS "users_tenant_read" ON public.users;

CREATE POLICY "users_tenant_read"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id
            FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------
-- Financial settlements: enable RLS + tenant policies
-- ---------------------------------------------------------------------
ALTER TABLE public.financial_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.title_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_event_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_settlements_tenant_access" ON public.financial_settlements;
DROP POLICY IF EXISTS "title_settlements_tenant_access" ON public.title_settlements;
DROP POLICY IF EXISTS "financial_event_allocations_tenant_access" ON public.financial_event_allocations;

CREATE POLICY "financial_settlements_tenant_access"
    ON public.financial_settlements
    FOR ALL
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id
            FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT company_id
            FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "financial_event_allocations_tenant_access"
    ON public.financial_event_allocations
    FOR ALL
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id
            FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT company_id
            FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "title_settlements_tenant_access"
    ON public.title_settlements
    FOR ALL
    TO authenticated
    USING (
        settlement_id IN (
            SELECT id
            FROM public.financial_settlements
            WHERE company_id IN (
                SELECT company_id
                FROM public.company_members
                WHERE auth_user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        settlement_id IN (
            SELECT id
            FROM public.financial_settlements
            WHERE company_id IN (
                SELECT company_id
                FROM public.company_members
                WHERE auth_user_id = auth.uid()
            )
        )
    );

