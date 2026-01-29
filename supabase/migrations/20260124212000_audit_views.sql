-- Migration: Additional Audit Views (V1)
-- Description: 4 new views to audit DRE integrity (Revenue vs Returns vs Stock vs Price)

BEGIN;

-- A) audit_dre_return_without_prior_revenue_v1
-- Detects Returns (Inventory Movement) where the product was never delivered in that context (or qty 0).
CREATE OR REPLACE VIEW public.audit_dre_return_without_prior_revenue_v1 AS
SELECT
    im.company_id,
    im.id as inventory_movement_id,
    im.reference_id as delivery_id,
    im.item_id as product_id,
    im.qty_base as returned_qty,
    im.occurred_at,
    -- Attempt to find total delivered for this product in this order (inferred via delivery)
    COALESCE(delivery_stats.total_delivered, 0) as total_delivered_in_order
FROM public.inventory_movements im
JOIN public.deliveries d ON im.reference_id = d.id -- Link to delivery context
LEFT JOIN (
    -- Aggregated delivery stats per Order + Product
    -- We join Delivery Items -> Sales Items -> Product
    SELECT 
        d_inner.sales_document_id,
        sdi_inner.item_id as product_id,
        SUM(di_inner.qty_delivered) as total_delivered
    FROM public.delivery_items di_inner
    JOIN public.deliveries d_inner ON di_inner.delivery_id = d_inner.id
    JOIN public.sales_document_items sdi_inner ON di_inner.sales_document_item_id = sdi_inner.id
    GROUP BY d_inner.sales_document_id, sdi_inner.item_id
) delivery_stats ON d.sales_document_id = delivery_stats.sales_document_id AND im.item_id = delivery_stats.product_id
WHERE 
    im.movement_type = 'ENTRADA' 
    AND im.reason = 'customer_return'
    AND COALESCE(delivery_stats.total_delivered, 0) < 0.001; -- "Zero" delivered

-- B) audit_dre_double_count_delivery_v1
-- Detects if an item was counted as revenue more than ordered (Duplication or Over-delivery)
CREATE OR REPLACE VIEW public.audit_dre_double_count_delivery_v1 AS
SELECT
    r.company_id,
    r.order_id,
    r.item_ref_id as sales_item_id,
    sdi.quantity as ordered_qty,
    SUM(r.qty_delivered) as total_revenue_qty,
    (SUM(r.qty_delivered) - sdi.quantity) as excess_qty
FROM public.dre_revenue_realized_v2 r
JOIN public.sales_document_items sdi ON r.item_ref_id = sdi.id
GROUP BY r.company_id, r.order_id, r.item_ref_id, sdi.quantity
HAVING SUM(r.qty_delivered) > (sdi.quantity + 0.001);

-- C) audit_dre_return_qty_exceeds_delivered_v1
-- Detects if we returned more than we delivered (Impossible transaction)
CREATE OR REPLACE VIEW public.audit_dre_return_qty_exceeds_delivered_v1 AS
SELECT
    rt.company_id,
    rt.order_id,
    rt.item_ref_id as sales_item_id,
    COALESCE(rev_stats.delivered_qty, 0) as delivered_qty,
    SUM(rt.qty_returned) as returned_qty,
    (SUM(rt.qty_returned) - COALESCE(rev_stats.delivered_qty, 0)) as discrepancy
FROM public.dre_returns_v2 rt
LEFT JOIN (
    SELECT 
        item_ref_id, 
        SUM(qty_delivered) as delivered_qty 
    FROM public.dre_revenue_realized_v2 
    GROUP BY item_ref_id
) rev_stats ON rt.item_ref_id = rev_stats.item_ref_id
GROUP BY rt.company_id, rt.order_id, rt.item_ref_id, rev_stats.delivered_qty
HAVING SUM(rt.qty_returned) > (COALESCE(rev_stats.delivered_qty, 0) + 0.001);

-- D) audit_dre_price_source_mismatch_v1
-- Detects Price used in Return vs Net Price of Item (Unit Price - Discount)
-- If Discount Amount > 0, we expect Return Price to be Net, but currently it might be Gross.
CREATE OR REPLACE VIEW public.audit_dre_price_source_mismatch_v1 AS
SELECT
    rt.company_id,
    rt.delivery_id,
    rt.item_ref_id as sales_item_id,
    sdi.unit_price as gross_unit_price,
    sdi.discount_amount,
    sdi.quantity,
    sdi.total_amount,
    -- Calculated Expected Net Price (Avoid div by zero)
    CASE 
        WHEN sdi.quantity > 0 THEN ROUND((sdi.total_amount / sdi.quantity), 4)
        ELSE 0 
    END as expected_net_price,
    -- Price used in View
    rt.unit_price as used_return_price,
    -- Diff
    (rt.unit_price - (CASE WHEN sdi.quantity > 0 THEN (sdi.total_amount / sdi.quantity) ELSE 0 END)) as price_divergence
FROM public.dre_returns_v2 rt
JOIN public.sales_document_items sdi ON rt.item_ref_id = sdi.id
WHERE 
    ABS(rt.unit_price - (CASE WHEN sdi.quantity > 0 THEN (sdi.total_amount / sdi.quantity) ELSE 0 END)) > 0.01;

COMMIT;
