-- fix_rls_multiple_permissive_policies
-- Objetivo: eliminar warnings 0006 (multiple permissive policies) sem ampliar permissões.
-- Estratégia:
-- 1) Remover policies PERMISSIVE redundantes nas tabelas alvo.
-- 2) Recriar policies canônicas (1 por role/cmd) para role authenticated.
-- 3) Manter ou endurecer predicados de tenant (nunca afrouxar).
--
-- Antes (inventário):
-- - Duplicidade por (table, role, cmd), principalmente por:
--   a) coexistência de TO public + TO authenticated
--   b) policy FOR ALL junto com policy SELECT/INSERT/UPDATE/DELETE para a mesma role
-- - Exemplos observados:
--   * ar_titles: ar_titles_tenant_access + Users can view/insert/update/delete own company ar_titles
--   * fiscal_operations: ...for their company + ...fiscal ops
--   * organizations: Enable read for authenticated users + Tenant read access + Organizations are viewable...
--   * sales_document_items: sales_document_items_multi_tenant + sales_items_access + Users can manage...
--   * sales_documents: sales_docs_access + sales_documents_multi_tenant + Users can ...
--
-- Depois: neste escopo, cada tabela alvo fica com conjunto canônico sem
-- duplicidade permissive por (table, role, cmd), mantendo isolamento multi-tenant.
-- Padrão de nomes no destino: <table>_tenant_<cmd>.

BEGIN;

-- ========================================
-- 1) Limpeza das permissive redundantes
-- ========================================
DO $$
DECLARE
    p RECORD;
BEGIN
    FOR p IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND permissive = 'PERMISSIVE'
          AND tablename IN (
            'ar_titles',
            'delivery_reasons',
            'fiscal_operations',
            'order_item_pending_balances',
            'product_categories',
            'ar_installments',
            'company_bank_accounts',
            'company_members',
            'crm_deals',
            'delivery_route_orders',
            'delivery_routes',
            'financial_categories',
            'financial_event_allocations',
            'financial_settlements',
            'organizations',
            'price_table_items',
            'recurring_rules',
            'sales_document_items',
            'sales_document_payments',
            'sales_documents',
            'system_occurrence_reason_defaults',
            'system_occurrence_reasons',
            'system_occurrence_types',
            'title_settlements',
            'users'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
    END LOOP;
END
$$;

-- ========================================
-- 2) Policies canônicas por tabela
-- ========================================

-- ar_titles
CREATE POLICY ar_titles_tenant_select ON public.ar_titles
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY ar_titles_tenant_insert ON public.ar_titles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY ar_titles_tenant_update ON public.ar_titles
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY ar_titles_tenant_delete ON public.ar_titles
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- ar_installments
CREATE POLICY ar_installments_tenant_select ON public.ar_installments
  FOR SELECT TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.ar_titles t
      WHERE t.id = ar_installments.ar_title_id
        AND public.is_member_of(t.company_id)
    )
  );

CREATE POLICY ar_installments_tenant_insert ON public.ar_installments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.ar_titles t
      WHERE t.id = ar_installments.ar_title_id
        AND public.is_member_of(t.company_id)
    )
  );

CREATE POLICY ar_installments_tenant_update ON public.ar_installments
  FOR UPDATE TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.ar_titles t
      WHERE t.id = ar_installments.ar_title_id
        AND public.is_member_of(t.company_id)
    )
  )
  WITH CHECK (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.ar_titles t
      WHERE t.id = ar_installments.ar_title_id
        AND public.is_member_of(t.company_id)
    )
  );

CREATE POLICY ar_installments_tenant_delete ON public.ar_installments
  FOR DELETE TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.ar_titles t
      WHERE t.id = ar_installments.ar_title_id
        AND public.is_member_of(t.company_id)
    )
  );

-- delivery_reasons
CREATE POLICY delivery_reasons_tenant_select ON public.delivery_reasons
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY delivery_reasons_tenant_insert ON public.delivery_reasons
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY delivery_reasons_tenant_update ON public.delivery_reasons
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY delivery_reasons_tenant_delete ON public.delivery_reasons
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- fiscal_operations
CREATE POLICY fiscal_operations_tenant_select ON public.fiscal_operations
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY fiscal_operations_tenant_insert ON public.fiscal_operations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY fiscal_operations_tenant_update ON public.fiscal_operations
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY fiscal_operations_tenant_delete ON public.fiscal_operations
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- order_item_pending_balances
CREATE POLICY order_item_pending_balances_tenant_select ON public.order_item_pending_balances
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY order_item_pending_balances_tenant_insert ON public.order_item_pending_balances
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY order_item_pending_balances_tenant_update ON public.order_item_pending_balances
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY order_item_pending_balances_tenant_delete ON public.order_item_pending_balances
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- product_categories
CREATE POLICY product_categories_tenant_select ON public.product_categories
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR public.is_member_of(company_id));

CREATE POLICY product_categories_tenant_insert ON public.product_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY product_categories_tenant_update ON public.product_categories
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY product_categories_tenant_delete ON public.product_categories
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- company_bank_accounts
CREATE POLICY company_bank_accounts_tenant_select ON public.company_bank_accounts
  FOR SELECT TO authenticated
  USING (
    public.has_company_role(
      company_id,
      ARRAY['owner','admin','sales','finance','logistics']
    )
  );

CREATE POLICY company_bank_accounts_tenant_insert ON public.company_bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_company_role(
      company_id,
      ARRAY['owner','admin','finance']
    )
  );

CREATE POLICY company_bank_accounts_tenant_update ON public.company_bank_accounts
  FOR UPDATE TO authenticated
  USING (
    public.has_company_role(
      company_id,
      ARRAY['owner','admin','finance']
    )
  )
  WITH CHECK (
    public.has_company_role(
      company_id,
      ARRAY['owner','admin','finance']
    )
  );

CREATE POLICY company_bank_accounts_tenant_delete ON public.company_bank_accounts
  FOR DELETE TO authenticated
  USING (
    public.has_company_role(
      company_id,
      ARRAY['owner','admin','finance']
    )
  );

-- company_members
CREATE POLICY company_members_tenant_select ON public.company_members
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- crm_deals
CREATE POLICY crm_deals_tenant_select ON public.crm_deals
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY crm_deals_tenant_insert ON public.crm_deals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY crm_deals_tenant_update ON public.crm_deals
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY crm_deals_tenant_delete ON public.crm_deals
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- delivery_route_orders
CREATE POLICY delivery_route_orders_tenant_select ON public.delivery_route_orders
  FOR SELECT TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = delivery_route_orders.sales_document_id
        AND public.is_member_of(sd.company_id)
    )
  );

CREATE POLICY delivery_route_orders_tenant_insert ON public.delivery_route_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = delivery_route_orders.sales_document_id
        AND public.is_member_of(sd.company_id)
    )
  );

CREATE POLICY delivery_route_orders_tenant_update ON public.delivery_route_orders
  FOR UPDATE TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = delivery_route_orders.sales_document_id
        AND public.is_member_of(sd.company_id)
    )
  )
  WITH CHECK (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = delivery_route_orders.sales_document_id
        AND public.is_member_of(sd.company_id)
    )
  );

CREATE POLICY delivery_route_orders_tenant_delete ON public.delivery_route_orders
  FOR DELETE TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = delivery_route_orders.sales_document_id
        AND public.is_member_of(sd.company_id)
    )
  );

-- delivery_routes
CREATE POLICY delivery_routes_tenant_select ON public.delivery_routes
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY delivery_routes_tenant_insert ON public.delivery_routes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY delivery_routes_tenant_update ON public.delivery_routes
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY delivery_routes_tenant_delete ON public.delivery_routes
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- financial_categories
CREATE POLICY financial_categories_tenant_select ON public.financial_categories
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY financial_categories_tenant_insert ON public.financial_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY financial_categories_tenant_update ON public.financial_categories
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY financial_categories_tenant_delete ON public.financial_categories
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- financial_event_allocations
CREATE POLICY financial_event_allocations_tenant_select ON public.financial_event_allocations
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY financial_event_allocations_tenant_insert ON public.financial_event_allocations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY financial_event_allocations_tenant_update ON public.financial_event_allocations
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY financial_event_allocations_tenant_delete ON public.financial_event_allocations
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- financial_settlements
CREATE POLICY financial_settlements_tenant_select ON public.financial_settlements
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY financial_settlements_tenant_insert ON public.financial_settlements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY financial_settlements_tenant_update ON public.financial_settlements
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY financial_settlements_tenant_delete ON public.financial_settlements
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- organizations
CREATE POLICY organizations_tenant_select ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY organizations_tenant_insert ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY organizations_tenant_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY organizations_tenant_delete ON public.organizations
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- price_table_items
CREATE POLICY price_table_items_tenant_select ON public.price_table_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.price_tables pt
      WHERE pt.id = price_table_items.price_table_id
        AND public.is_member_of(pt.company_id)
    )
  );

CREATE POLICY price_table_items_tenant_insert ON public.price_table_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.price_tables pt
      WHERE pt.id = price_table_items.price_table_id
        AND public.is_member_of(pt.company_id)
    )
  );

CREATE POLICY price_table_items_tenant_update ON public.price_table_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.price_tables pt
      WHERE pt.id = price_table_items.price_table_id
        AND public.is_member_of(pt.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.price_tables pt
      WHERE pt.id = price_table_items.price_table_id
        AND public.is_member_of(pt.company_id)
    )
  );

CREATE POLICY price_table_items_tenant_delete ON public.price_table_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.price_tables pt
      WHERE pt.id = price_table_items.price_table_id
        AND public.is_member_of(pt.company_id)
    )
  );

-- recurring_rules
CREATE POLICY recurring_rules_tenant_select ON public.recurring_rules
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

-- sales_documents
CREATE POLICY sales_documents_tenant_select ON public.sales_documents
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

CREATE POLICY sales_documents_tenant_insert ON public.sales_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY sales_documents_tenant_update ON public.sales_documents
  FOR UPDATE TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

CREATE POLICY sales_documents_tenant_delete ON public.sales_documents
  FOR DELETE TO authenticated
  USING (public.is_member_of(company_id));

-- sales_document_items
CREATE POLICY sales_document_items_tenant_select ON public.sales_document_items
  FOR SELECT TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = sales_document_items.document_id
        AND public.is_member_of(sd.company_id)
    )
  );

CREATE POLICY sales_document_items_tenant_insert ON public.sales_document_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = sales_document_items.document_id
        AND public.is_member_of(sd.company_id)
    )
  );

CREATE POLICY sales_document_items_tenant_update ON public.sales_document_items
  FOR UPDATE TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = sales_document_items.document_id
        AND public.is_member_of(sd.company_id)
    )
  )
  WITH CHECK (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = sales_document_items.document_id
        AND public.is_member_of(sd.company_id)
    )
  );

CREATE POLICY sales_document_items_tenant_delete ON public.sales_document_items
  FOR DELETE TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = sales_document_items.document_id
        AND public.is_member_of(sd.company_id)
    )
  );

-- sales_document_payments
CREATE POLICY sales_document_payments_tenant_select ON public.sales_document_payments
  FOR SELECT TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = sales_document_payments.document_id
        AND public.is_member_of(sd.company_id)
    )
  );

CREATE POLICY sales_document_payments_tenant_insert ON public.sales_document_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = sales_document_payments.document_id
        AND public.is_member_of(sd.company_id)
    )
  );

CREATE POLICY sales_document_payments_tenant_update ON public.sales_document_payments
  FOR UPDATE TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = sales_document_payments.document_id
        AND public.is_member_of(sd.company_id)
    )
  )
  WITH CHECK (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = sales_document_payments.document_id
        AND public.is_member_of(sd.company_id)
    )
  );

CREATE POLICY sales_document_payments_tenant_delete ON public.sales_document_payments
  FOR DELETE TO authenticated
  USING (
    public.is_member_of(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.sales_documents sd
      WHERE sd.id = sales_document_payments.document_id
        AND public.is_member_of(sd.company_id)
    )
  );

-- system_occurrence_types
CREATE POLICY system_occurrence_types_tenant_select ON public.system_occurrence_types
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.auth_user_id = auth.uid()
    )
  );

CREATE POLICY system_occurrence_types_tenant_insert ON public.system_occurrence_types
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.auth_user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

CREATE POLICY system_occurrence_types_tenant_update ON public.system_occurrence_types
  FOR UPDATE TO authenticated
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

CREATE POLICY system_occurrence_types_tenant_delete ON public.system_occurrence_types
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.auth_user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- system_occurrence_reasons
CREATE POLICY system_occurrence_reasons_tenant_select ON public.system_occurrence_reasons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.auth_user_id = auth.uid()
    )
  );

CREATE POLICY system_occurrence_reasons_tenant_insert ON public.system_occurrence_reasons
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.auth_user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

CREATE POLICY system_occurrence_reasons_tenant_update ON public.system_occurrence_reasons
  FOR UPDATE TO authenticated
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

CREATE POLICY system_occurrence_reasons_tenant_delete ON public.system_occurrence_reasons
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.auth_user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- system_occurrence_reason_defaults
CREATE POLICY system_occurrence_reason_defaults_tenant_select ON public.system_occurrence_reason_defaults
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.auth_user_id = auth.uid()
    )
  );

CREATE POLICY system_occurrence_reason_defaults_tenant_insert ON public.system_occurrence_reason_defaults
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.auth_user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

CREATE POLICY system_occurrence_reason_defaults_tenant_update ON public.system_occurrence_reason_defaults
  FOR UPDATE TO authenticated
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

CREATE POLICY system_occurrence_reason_defaults_tenant_delete ON public.system_occurrence_reason_defaults
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.auth_user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- title_settlements
CREATE POLICY title_settlements_tenant_select ON public.title_settlements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.financial_settlements fs
      WHERE fs.id = title_settlements.settlement_id
        AND public.is_member_of(fs.company_id)
    )
  );

CREATE POLICY title_settlements_tenant_insert ON public.title_settlements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.financial_settlements fs
      WHERE fs.id = title_settlements.settlement_id
        AND public.is_member_of(fs.company_id)
    )
  );

CREATE POLICY title_settlements_tenant_update ON public.title_settlements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.financial_settlements fs
      WHERE fs.id = title_settlements.settlement_id
        AND public.is_member_of(fs.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.financial_settlements fs
      WHERE fs.id = title_settlements.settlement_id
        AND public.is_member_of(fs.company_id)
    )
  );

CREATE POLICY title_settlements_tenant_delete ON public.title_settlements
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.financial_settlements fs
      WHERE fs.id = title_settlements.settlement_id
        AND public.is_member_of(fs.company_id)
    )
  );

-- users
CREATE POLICY users_tenant_select ON public.users
  FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

COMMIT;
