-- Plano de Contas: backfill de rateio para legado 1:1 e trilha de revisão.
-- Commit 5/6: cria allocation única quando houver account_id legado e registra NEEDS_REVIEW nos demais casos.

CREATE TABLE IF NOT EXISTS public.installment_allocation_backfill_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    installment_id uuid NOT NULL,
    installment_type text NOT NULL CHECK (installment_type IN ('AR', 'AP')),
    reason text NOT NULL,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_allocation_backfill_audit_unique_installment
    ON public.installment_allocation_backfill_audit(installment_type, installment_id);

ALTER TABLE public.installment_allocation_backfill_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS installment_allocation_backfill_audit_tenant_select ON public.installment_allocation_backfill_audit;
CREATE POLICY installment_allocation_backfill_audit_tenant_select
    ON public.installment_allocation_backfill_audit FOR SELECT TO authenticated
    USING (is_member_of(company_id));

DROP POLICY IF EXISTS installment_allocation_backfill_audit_tenant_insert ON public.installment_allocation_backfill_audit;
CREATE POLICY installment_allocation_backfill_audit_tenant_insert
    ON public.installment_allocation_backfill_audit FOR INSERT TO authenticated
    WITH CHECK (is_member_of(company_id));

INSERT INTO public.ar_installment_allocations (
    company_id,
    ar_installment_id,
    gl_account_id,
    cost_center_id,
    amount
)
SELECT
    installment.company_id,
    installment.id,
    installment.account_id,
    installment.cost_center_id,
    installment.amount_original
FROM public.ar_installments AS installment
WHERE installment.account_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.ar_installment_allocations allocation
      WHERE allocation.ar_installment_id = installment.id
  );

INSERT INTO public.ap_installment_allocations (
    company_id,
    ap_installment_id,
    gl_account_id,
    cost_center_id,
    amount
)
SELECT
    installment.company_id,
    installment.id,
    installment.account_id,
    installment.cost_center_id,
    installment.amount_original
FROM public.ap_installments AS installment
WHERE installment.account_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.ap_installment_allocations allocation
      WHERE allocation.ap_installment_id = installment.id
  );

INSERT INTO public.installment_allocation_backfill_audit (
    company_id,
    installment_id,
    installment_type,
    reason,
    details
)
SELECT
    installment.company_id,
    installment.id,
    'AR',
    'NEEDS_REVIEW',
    jsonb_build_object(
        'status', installment.status,
        'amount_original', installment.amount_original,
        'legacy_account_id', installment.account_id
    )
FROM public.ar_installments installment
WHERE installment.account_id IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.ar_installment_allocations allocation
      WHERE allocation.ar_installment_id = installment.id
  )
ON CONFLICT (installment_type, installment_id) DO NOTHING;

INSERT INTO public.installment_allocation_backfill_audit (
    company_id,
    installment_id,
    installment_type,
    reason,
    details
)
SELECT
    installment.company_id,
    installment.id,
    'AP',
    'NEEDS_REVIEW',
    jsonb_build_object(
        'status', installment.status,
        'amount_original', installment.amount_original,
        'legacy_account_id', installment.account_id
    )
FROM public.ap_installments installment
WHERE installment.account_id IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.ap_installment_allocations allocation
      WHERE allocation.ap_installment_id = installment.id
  )
ON CONFLICT (installment_type, installment_id) DO NOTHING;
