-- Add loading checklist fields to sales_documents
-- Migration: 20251225210000_add_loading_checklist_fields.sql

ALTER TABLE sales_documents
ADD COLUMN IF NOT EXISTS loading_checked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS loading_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS loading_checked_by UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sales_documents_loading_checked 
ON sales_documents(loading_checked) WHERE loading_checked = TRUE;

-- Add RPC function for product aggregation by route
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
        i.unit,
        SUM(sdi.quantity) as total_quantity
    FROM delivery_route_orders dro
    JOIN sales_documents sd ON sd.id = dro.sales_document_id
    JOIN sales_document_items sdi ON sdi.document_id = sd.id
    JOIN items i ON i.id = sdi.item_id
    WHERE dro.route_id = p_route_id
      AND sd.deleted_at IS NULL
    GROUP BY i.id, i.name, i.sku, i.unit
    ORDER BY i.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
