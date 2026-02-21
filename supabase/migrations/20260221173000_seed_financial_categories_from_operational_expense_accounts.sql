-- Seed/sync: Financial Categories from existing Operational Expense (4.*) final accounts
--
-- Goal:
-- - Ensure the "Categoria" selector in Fatos Geradores can list existing accounts under item 4
-- - Keep it idempotent: safe to run multiple times
--
-- Rule:
-- - Only creates categories for ANALITICA + DESPESA accounts whose code is under 4.*
-- - Skips if there is already an active category linked to the account
-- - Uses ON CONFLICT on (company_id, name) (active) to avoid failing in rare name collisions

CREATE OR REPLACE FUNCTION public.seed_financial_categories_for_operational_expenses(
  p_company_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  -- Best-effort permission guard (service_role or company member).
  IF auth.role() <> 'service_role' AND NOT public.is_member_of(p_company_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para sincronizar categorias nesta empresa.' USING ERRCODE = '42501';
  END IF;

  -- Ensure the fixed chart spine exists for this tenant.
  PERFORM public.seed_chart_spine(p_company_id);

  INSERT INTO public.financial_categories (
    company_id,
    name,
    is_active,
    expense_account_id
  )
  SELECT
    a.company_id,
    a.name,
    COALESCE(a.is_active, true),
    a.id
  FROM public.gl_accounts a
  WHERE a.company_id = p_company_id
    AND a.type = 'ANALITICA'
    AND a.nature = 'DESPESA'
    AND a.code ~ '^4(\\.|$)'
    AND NOT EXISTS (
      SELECT 1
      FROM public.financial_categories c
      WHERE c.company_id = a.company_id
        AND c.deleted_at IS NULL
        AND c.expense_account_id = a.id
    )
  ON CONFLICT (company_id, name) WHERE deleted_at IS NULL DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_financial_categories_for_operational_expenses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_financial_categories_for_operational_expenses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_financial_categories_for_operational_expenses(uuid) TO service_role;

-- Backfill all existing companies (idempotent)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_chart_spine(r.id);
    -- Call the seed directly (runs without request JWT; permission guard is best-effort).
    PERFORM public.seed_financial_categories_for_operational_expenses(r.id);
  END LOOP;
END $$;

