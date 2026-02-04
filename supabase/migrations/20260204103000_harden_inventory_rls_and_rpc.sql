-- Harden Inventory RLS and RPC privileges

-- ------------------------------------------------------------------------
-- inventory_movements: remove permissive policies and enforce tenant access
-- ------------------------------------------------------------------------

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.inventory_movements;
DROP POLICY IF EXISTS "inventory_movements_tenant_access" ON public.inventory_movements;

CREATE POLICY "inventory_movements_tenant_access"
    ON public.inventory_movements
    FOR ALL
    TO authenticated
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

-- ------------------------------------------------------------------------
-- deduct_stock_from_route: restrict SECURITY DEFINER execution
-- ------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.deduct_stock_from_route(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deduct_stock_from_route(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.deduct_stock_from_route(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_stock_from_route(UUID, UUID) TO service_role;

