-- Harden Financial RLS (multi-tenant)
-- Removes permissive dev policies and enforces `company_id` scoping via `public.is_member_of`.

-- ------------------------------------------------------------------------
-- Commercial tables
-- ------------------------------------------------------------------------

-- price_tables: remove legacy dev policy (other tenant policies should remain)
DROP POLICY IF EXISTS "Enable all for devs" ON public.price_tables;
ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_tables_tenant_access" ON public.price_tables;

CREATE POLICY "price_tables_tenant_access"
    ON public.price_tables
    FOR ALL
    TO authenticated
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

-- payment_terms: replace legacy dev policy with tenant policy
ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for devs" ON public.payment_terms;
DROP POLICY IF EXISTS "payment_terms_tenant_access" ON public.payment_terms;

CREATE POLICY "payment_terms_tenant_access"
    ON public.payment_terms
    FOR ALL
    TO authenticated
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

-- ------------------------------------------------------------------------
-- Accounts Receivable (AR)
-- ------------------------------------------------------------------------

ALTER TABLE public.ar_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_payment_allocations ENABLE ROW LEVEL SECURITY;

-- Drop permissive dev policies
DROP POLICY IF EXISTS "Enable all for ar_titles" ON public.ar_titles;
DROP POLICY IF EXISTS "Enable all for ar_installments" ON public.ar_installments;
DROP POLICY IF EXISTS "Enable all for ar_payments" ON public.ar_payments;
DROP POLICY IF EXISTS "Enable all for ar_payment_allocations" ON public.ar_payment_allocations;

-- Replace with tenant policies
DROP POLICY IF EXISTS "ar_titles_tenant_access" ON public.ar_titles;
DROP POLICY IF EXISTS "ar_installments_tenant_access" ON public.ar_installments;
DROP POLICY IF EXISTS "ar_payments_tenant_access" ON public.ar_payments;
DROP POLICY IF EXISTS "ar_payment_allocations_tenant_access" ON public.ar_payment_allocations;

CREATE POLICY "ar_titles_tenant_access"
    ON public.ar_titles
    FOR ALL
    TO authenticated
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "ar_installments_tenant_access"
    ON public.ar_installments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.ar_titles t
            WHERE t.id = ar_installments.ar_title_id
              AND public.is_member_of(t.company_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.ar_titles t
            WHERE t.id = ar_installments.ar_title_id
              AND public.is_member_of(t.company_id)
        )
    );

CREATE POLICY "ar_payments_tenant_access"
    ON public.ar_payments
    FOR ALL
    TO authenticated
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "ar_payment_allocations_tenant_access"
    ON public.ar_payment_allocations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.ar_payments p
            JOIN public.ar_installments i ON i.id = ar_payment_allocations.installment_id
            WHERE p.id = ar_payment_allocations.payment_id
              AND EXISTS (
                  SELECT 1
                  FROM public.ar_titles t
                  WHERE t.id = i.ar_title_id
                    AND t.company_id = p.company_id
                    AND public.is_member_of(t.company_id)
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.ar_payments p
            JOIN public.ar_installments i ON i.id = ar_payment_allocations.installment_id
            WHERE p.id = ar_payment_allocations.payment_id
              AND EXISTS (
                  SELECT 1
                  FROM public.ar_titles t
                  WHERE t.id = i.ar_title_id
                    AND t.company_id = p.company_id
                    AND public.is_member_of(t.company_id)
              )
        )
    );

-- ------------------------------------------------------------------------
-- Accounts Payable (AP)
-- ------------------------------------------------------------------------

ALTER TABLE public.ap_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_payment_allocations ENABLE ROW LEVEL SECURITY;

-- Drop permissive dev policies
DROP POLICY IF EXISTS "Enable all for ap_titles" ON public.ap_titles;
DROP POLICY IF EXISTS "Enable all for ap_installments" ON public.ap_installments;
DROP POLICY IF EXISTS "Enable all for ap_payments" ON public.ap_payments;
DROP POLICY IF EXISTS "Enable all for ap_payment_allocations" ON public.ap_payment_allocations;

-- Replace with tenant policies
DROP POLICY IF EXISTS "ap_titles_tenant_access" ON public.ap_titles;
DROP POLICY IF EXISTS "ap_installments_tenant_access" ON public.ap_installments;
DROP POLICY IF EXISTS "ap_payments_tenant_access" ON public.ap_payments;
DROP POLICY IF EXISTS "ap_payment_allocations_tenant_access" ON public.ap_payment_allocations;

CREATE POLICY "ap_titles_tenant_access"
    ON public.ap_titles
    FOR ALL
    TO authenticated
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "ap_installments_tenant_access"
    ON public.ap_installments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.ap_titles t
            WHERE t.id = ap_installments.ap_title_id
              AND public.is_member_of(t.company_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.ap_titles t
            WHERE t.id = ap_installments.ap_title_id
              AND public.is_member_of(t.company_id)
        )
    );

CREATE POLICY "ap_payments_tenant_access"
    ON public.ap_payments
    FOR ALL
    TO authenticated
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "ap_payment_allocations_tenant_access"
    ON public.ap_payment_allocations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.ap_payments p
            JOIN public.ap_installments i ON i.id = ap_payment_allocations.installment_id
            WHERE p.id = ap_payment_allocations.payment_id
              AND EXISTS (
                  SELECT 1
                  FROM public.ap_titles t
                  WHERE t.id = i.ap_title_id
                    AND t.company_id = p.company_id
                    AND public.is_member_of(t.company_id)
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.ap_payments p
            JOIN public.ap_installments i ON i.id = ap_payment_allocations.installment_id
            WHERE p.id = ap_payment_allocations.payment_id
              AND EXISTS (
                  SELECT 1
                  FROM public.ap_titles t
                  WHERE t.id = i.ap_title_id
                    AND t.company_id = p.company_id
                    AND public.is_member_of(t.company_id)
              )
        )
    );
