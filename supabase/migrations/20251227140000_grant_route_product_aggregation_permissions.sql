-- Grant execute permissions on get_route_product_aggregation function
-- Migration: 20251227140000_grant_route_product_aggregation_permissions.sql

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_route_product_aggregation(UUID) TO authenticated;

-- Ensure the function is accessible
COMMENT ON FUNCTION get_route_product_aggregation(UUID) IS 'Aggregates products by route for loading checklist';
