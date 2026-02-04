-- Harden RLS: occurrence logs + financial installments
--
-- Why:
-- - Previous policies allowed authenticated users to INSERT/UPDATE rows with `USING/WITH CHECK (true)`,
--   which is unsafe for multi-tenant isolation.
-- - This migration removes those permissive policies and replaces them with tenant-scoped checks.

-- ---------------------------------------------------------------------
-- financial_event_installments: remove permissive hotfix policies
-- (table already has `financial_event_installments_multi_tenant` policy)
-- ---------------------------------------------------------------------
ALTER TABLE public.financial_event_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable update for users" ON public.financial_event_installments;
DROP POLICY IF EXISTS "Enable insert for users" ON public.financial_event_installments;

-- ---------------------------------------------------------------------
-- order_occurrence_logs: tenant-scoped read/insert
-- ---------------------------------------------------------------------
ALTER TABLE public.order_occurrence_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.order_occurrence_logs;
DROP POLICY IF EXISTS "Allow insert for logs" ON public.order_occurrence_logs;

CREATE POLICY "order_occurrence_logs_tenant_read"
    ON public.order_occurrence_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.sales_documents sd
            JOIN public.company_members cm ON cm.company_id = sd.company_id
            WHERE sd.id = order_occurrence_logs.order_id
              AND cm.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "order_occurrence_logs_tenant_insert"
    ON public.order_occurrence_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.sales_documents sd
            JOIN public.company_members cm ON cm.company_id = sd.company_id
            WHERE sd.id = order_occurrence_logs.order_id
              AND cm.auth_user_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------
-- route_event_logs: tenant-scoped read/insert
-- ---------------------------------------------------------------------
ALTER TABLE public.route_event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.route_event_logs;
DROP POLICY IF EXISTS "Allow insert for logs" ON public.route_event_logs;

CREATE POLICY "route_event_logs_tenant_read"
    ON public.route_event_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.delivery_routes r
            JOIN public.company_members cm ON cm.company_id = r.company_id
            WHERE r.id = route_event_logs.route_id
              AND cm.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "route_event_logs_tenant_insert"
    ON public.route_event_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.delivery_routes r
            JOIN public.company_members cm ON cm.company_id = r.company_id
            WHERE r.id = route_event_logs.route_id
              AND cm.auth_user_id = auth.uid()
        )
    );

