-- Plano de Contas: rateio contábil por parcela (AR/AP)
-- Commit 1/6: estrutura mínima de allocations com FKs, índices e constraints básicas.

CREATE TABLE IF NOT EXISTS public.ar_installment_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    ar_installment_id uuid NOT NULL REFERENCES public.ar_installments(id) ON DELETE CASCADE,
    gl_account_id uuid NOT NULL REFERENCES public.gl_accounts(id),
    cost_center_id uuid REFERENCES public.cost_centers(id),
    amount numeric(15,2) NOT NULL CHECK (amount > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ap_installment_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    ap_installment_id uuid NOT NULL REFERENCES public.ap_installments(id) ON DELETE CASCADE,
    gl_account_id uuid NOT NULL REFERENCES public.gl_accounts(id),
    cost_center_id uuid REFERENCES public.cost_centers(id),
    amount numeric(15,2) NOT NULL CHECK (amount > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ar_installment_allocations_installment
    ON public.ar_installment_allocations(ar_installment_id);

CREATE INDEX IF NOT EXISTS idx_ar_installment_allocations_company
    ON public.ar_installment_allocations(company_id);

CREATE INDEX IF NOT EXISTS idx_ar_installment_allocations_gl_account
    ON public.ar_installment_allocations(gl_account_id);

CREATE INDEX IF NOT EXISTS idx_ar_installment_allocations_cost_center
    ON public.ar_installment_allocations(cost_center_id);

CREATE INDEX IF NOT EXISTS idx_ap_installment_allocations_installment
    ON public.ap_installment_allocations(ap_installment_id);

CREATE INDEX IF NOT EXISTS idx_ap_installment_allocations_company
    ON public.ap_installment_allocations(company_id);

CREATE INDEX IF NOT EXISTS idx_ap_installment_allocations_gl_account
    ON public.ap_installment_allocations(gl_account_id);

CREATE INDEX IF NOT EXISTS idx_ap_installment_allocations_cost_center
    ON public.ap_installment_allocations(cost_center_id);

ALTER TABLE public.ar_installment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_installment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ar_installment_allocations_tenant_select ON public.ar_installment_allocations;
CREATE POLICY ar_installment_allocations_tenant_select
    ON public.ar_installment_allocations FOR SELECT TO authenticated
    USING (is_member_of(company_id));

DROP POLICY IF EXISTS ar_installment_allocations_tenant_insert ON public.ar_installment_allocations;
CREATE POLICY ar_installment_allocations_tenant_insert
    ON public.ar_installment_allocations FOR INSERT TO authenticated
    WITH CHECK (is_member_of(company_id));

DROP POLICY IF EXISTS ar_installment_allocations_tenant_update ON public.ar_installment_allocations;
CREATE POLICY ar_installment_allocations_tenant_update
    ON public.ar_installment_allocations FOR UPDATE TO authenticated
    USING (is_member_of(company_id))
    WITH CHECK (is_member_of(company_id));

DROP POLICY IF EXISTS ar_installment_allocations_tenant_delete ON public.ar_installment_allocations;
CREATE POLICY ar_installment_allocations_tenant_delete
    ON public.ar_installment_allocations FOR DELETE TO authenticated
    USING (is_member_of(company_id));

DROP POLICY IF EXISTS ap_installment_allocations_tenant_select ON public.ap_installment_allocations;
CREATE POLICY ap_installment_allocations_tenant_select
    ON public.ap_installment_allocations FOR SELECT TO authenticated
    USING (is_member_of(company_id));

DROP POLICY IF EXISTS ap_installment_allocations_tenant_insert ON public.ap_installment_allocations;
CREATE POLICY ap_installment_allocations_tenant_insert
    ON public.ap_installment_allocations FOR INSERT TO authenticated
    WITH CHECK (is_member_of(company_id));

DROP POLICY IF EXISTS ap_installment_allocations_tenant_update ON public.ap_installment_allocations;
CREATE POLICY ap_installment_allocations_tenant_update
    ON public.ap_installment_allocations FOR UPDATE TO authenticated
    USING (is_member_of(company_id))
    WITH CHECK (is_member_of(company_id));

DROP POLICY IF EXISTS ap_installment_allocations_tenant_delete ON public.ap_installment_allocations;
CREATE POLICY ap_installment_allocations_tenant_delete
    ON public.ap_installment_allocations FOR DELETE TO authenticated
    USING (is_member_of(company_id));

DROP TRIGGER IF EXISTS trg_ar_installment_allocations_updated_at ON public.ar_installment_allocations;
CREATE TRIGGER trg_ar_installment_allocations_updated_at
    BEFORE UPDATE ON public.ar_installment_allocations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ap_installment_allocations_updated_at ON public.ap_installment_allocations;
CREATE TRIGGER trg_ap_installment_allocations_updated_at
    BEFORE UPDATE ON public.ap_installment_allocations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
