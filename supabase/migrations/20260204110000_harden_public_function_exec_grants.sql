-- Harden EXECUTE grants on public schema functions
-- 1) Remove default PUBLIC/anon access
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- 2) Ensure service_role retains access for admin/worker scripts
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 3) Allowlist: app RPCs used by authenticated users
GRANT EXECUTE ON FUNCTION public.get_route_product_aggregation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_production_entry(UUID, NUMERIC, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_user_drafts(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_stock_from_route(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_sku(UUID) TO authenticated;

-- 4) RLS helper functions used in policies
GRANT EXECUTE ON FUNCTION public.is_member_of(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_company_role(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member_for_path(TEXT) TO authenticated;
