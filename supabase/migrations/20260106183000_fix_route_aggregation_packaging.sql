-- Migration to update get_route_product_aggregation to respect packaging units

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
        -- Use packaging label if available, otherwise product UOM
        COALESCE(ip.label, i.uom) as unit,
        SUM(sdi.quantity) as total_quantity
    FROM delivery_route_orders dro
    JOIN sales_documents sd ON sd.id = dro.sales_document_id
    JOIN sales_document_items sdi ON sdi.document_id = sd.id
    JOIN items i ON i.id = sdi.item_id
    LEFT JOIN item_packaging ip ON ip.id = sdi.packaging_id
    WHERE dro.route_id = p_route_id
      AND sd.deleted_at IS NULL
    -- Group by Packaging ID as well to separate "Box" from "Unit"
    GROUP BY i.id, i.name, i.sku, i.uom, ip.id, ip.label
    ORDER BY i.name, unit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_route_product_aggregation(UUID) TO authenticated;

COMMENT ON FUNCTION get_route_product_aggregation(UUID) IS 'Aggregates products by route for loading checklist, respecting packaging units';
