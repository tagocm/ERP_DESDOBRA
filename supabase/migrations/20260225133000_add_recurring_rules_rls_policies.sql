-- Garantir políticas RLS completas para recurring_rules sem abrir brechas.
-- Mantém o mesmo padrão tenant-aware usado em financial_categories.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recurring_rules'
      AND policyname = 'recurring_rules_tenant_insert'
  ) THEN
    CREATE POLICY recurring_rules_tenant_insert
      ON public.recurring_rules
      FOR INSERT
      WITH CHECK (is_member_of(company_id));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recurring_rules'
      AND policyname = 'recurring_rules_tenant_update'
  ) THEN
    CREATE POLICY recurring_rules_tenant_update
      ON public.recurring_rules
      FOR UPDATE
      USING (is_member_of(company_id))
      WITH CHECK (is_member_of(company_id));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recurring_rules'
      AND policyname = 'recurring_rules_tenant_delete'
  ) THEN
    CREATE POLICY recurring_rules_tenant_delete
      ON public.recurring_rules
      FOR DELETE
      USING (is_member_of(company_id));
  END IF;
END
$$;
