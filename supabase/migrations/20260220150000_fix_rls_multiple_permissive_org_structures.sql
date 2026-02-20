-- fix_rls_multiple_permissive_org_structures
-- Complementa a consolidação do lint 0006 para:
-- - public.organization_branches
-- - public.organization_roles
--
-- Antes:
-- - SELECT: "Tenant read access" + "... viewable by company" (+ efeito de ALL)
-- - INSERT/UPDATE/DELETE: "Tenant write access" + "... by company"
--
-- Depois:
-- - Uma policy permissive por cmd para role authenticated, com predicado canônico tenant.

BEGIN;

DO $$
DECLARE
    p RECORD;
BEGIN
    FOR p IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND permissive = 'PERMISSIVE'
          AND tablename IN ('organization_branches', 'organization_roles')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
    END LOOP;
END
$$;

-- organization_branches
CREATE POLICY organization_branches_tenant_select ON public.organization_branches
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY organization_branches_tenant_insert ON public.organization_branches
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY organization_branches_tenant_update ON public.organization_branches
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY organization_branches_tenant_delete ON public.organization_branches
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- organization_roles
CREATE POLICY organization_roles_tenant_select ON public.organization_roles
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY organization_roles_tenant_insert ON public.organization_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY organization_roles_tenant_update ON public.organization_roles
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY organization_roles_tenant_delete ON public.organization_roles
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

COMMIT;
