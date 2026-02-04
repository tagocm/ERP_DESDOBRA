-- Cleanup redundant price_tables policies (keep price_tables_tenant_access)

DROP POLICY IF EXISTS "price_tables_multi_tenant" ON public.price_tables;
