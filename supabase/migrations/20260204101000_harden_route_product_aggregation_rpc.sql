-- Harden get_route_product_aggregation RPC (multi-tenant)
-- Prevent cross-company reads via SECURITY DEFINER function.

DROP FUNCTION IF EXISTS public.get_route_product_aggregation(UUID);

CREATE OR REPLACE FUNCTION public.get_route_product_aggregation(p_route_id UUID)
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
    FROM public.delivery_route_orders dro
    JOIN public.delivery_routes dr ON dr.id = dro.route_id
    JOIN public.sales_documents sd ON sd.id = dro.sales_document_id
    JOIN public.sales_document_items sdi ON sdi.document_id = sd.id
    JOIN public.items i ON i.id = sdi.item_id
    WHERE dro.route_id = p_route_id
      AND public.is_member_of(dr.company_id)
      AND sd.deleted_at IS NULL
    GROUP BY i.id, i.name, i.sku, i.uom
    ORDER BY i.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.get_route_product_aggregation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_route_product_aggregation(UUID) TO authenticated;

