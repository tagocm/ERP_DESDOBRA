-- Revoke any explicit anon grants on get_route_product_aggregation

REVOKE ALL ON FUNCTION public.get_route_product_aggregation(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_route_product_aggregation(UUID) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_route_product_aggregation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_route_product_aggregation(UUID) TO service_role;
