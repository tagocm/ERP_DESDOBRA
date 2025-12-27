-- Fix get_route_product_aggregation function
-- Migration: 20251227150000_fix_route_product_aggregation.sql

-- Drop and recreate the function to ensure no stale references
DROP FUNCTION IF EXISTS get_route_product_aggregation(UUID);

CREATE OR REPLACE FUNCTION get_route_product_aggregation(p_route_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    sku TEXT,
    unit TEXT,
    total_quantity NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id as product_id,
        i.name as product_name,
        i.sku,
        i.uom as unit,
        SUM(sdi.quantity) as total_quantity
    FROM delivery_route_orders dro
    JOIN sales_documents sd ON sd.id = dro.sales_document_id
    JOIN sales_document_items sdi ON sdi.document_id = sd.id
    JOIN items i ON i.id = sdi.item_id
    WHERE dro.route_id = p_route_id
      AND sd.deleted_at IS NULL
    GROUP BY i.id, i.name, i.sku, i.uom
    ORDER BY i.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_route_product_aggregation(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_route_product_aggregation(UUID) IS 'Aggregates products by route for loading checklist - uses sales_documents table';
