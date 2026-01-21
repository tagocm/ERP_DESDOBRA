-- Migration: Update get_route_product_aggregation to respect partial deliveries
-- Date: 2026-01-05

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
    WITH delivered_counts AS (
        SELECT 
            di.sales_document_item_id as item_id,
            SUM(di.qty_delivered) as delivered_qty
        FROM delivery_items di
        JOIN deliveries d ON d.id = di.delivery_id
        WHERE d.status IN ('delivered', 'returned_partial', 'returned_total')
        GROUP BY di.sales_document_item_id
    )
    SELECT 
        i.id as product_id,
        i.name as product_name,
        i.sku,
        i.uom as unit,
        SUM(GREATEST(0, sdi.quantity - COALESCE(dc.delivered_qty, 0))) as total_quantity
    FROM delivery_route_orders dro
    JOIN sales_documents sd ON sd.id = dro.sales_document_id
    JOIN sales_document_items sdi ON sdi.document_id = sd.id
    JOIN items i ON i.id = sdi.item_id
    LEFT JOIN delivered_counts dc ON dc.item_id = sdi.id
    WHERE dro.route_id = p_route_id
      AND sd.deleted_at IS NULL
    GROUP BY i.id, i.name, i.sku, i.uom
    HAVING SUM(GREATEST(0, sdi.quantity - COALESCE(dc.delivered_qty, 0))) > 0
    ORDER BY i.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions just in case
GRANT EXECUTE ON FUNCTION get_route_product_aggregation(UUID) TO authenticated;
