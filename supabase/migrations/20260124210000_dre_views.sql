-- Migration: DRE Views V1
-- Description: Creates standardized views for Realized Revenue, Returns, and COGS.
-- Source of Truth: Deliveries (Revenue) and Inventory Movements (COGS).

BEGIN;

-- 1. DRE Revenue Realized V1
-- Logic: Revenue is recognized when items are DELIVERED (qty_delivered > 0) in a valid delivery.
-- We use the UNIT PRICE from the Sales Order Item (snapshot at time of order).
CREATE OR REPLACE VIEW public.dre_revenue_realized_v1 AS
SELECT
    di.company_id,
    d.created_at::DATE as occurrence_date, -- Delivery Date
    d.sales_document_id as order_id,
    d.id as delivery_id,
    di.sales_document_item_id as item_ref_id,
    di.qty_delivered,
    sdi.unit_price,
    (di.qty_delivered * sdi.unit_price) as revenue_amount,
    sdi.item_id as product_id,
    d.route_id
FROM public.delivery_items di
JOIN public.deliveries d ON di.delivery_id = d.id
JOIN public.sales_document_items sdi ON di.sales_document_item_id = sdi.id
WHERE 
    d.status NOT IN ('cancelled', 'draft', 'in_preparation') -- Only finalized/active deliveries
    AND di.qty_delivered > 0;

-- 2. DRE Returns V1
-- Logic: Returns are recognized when items are RETURNED (qty_returned > 0).
-- This covers both 'refused at delivery' and 'post-delivery return' if logged in delivery_items.
CREATE OR REPLACE VIEW public.dre_returns_v1 AS
SELECT
    di.company_id,
    d.updated_at::DATE as occurrence_date, -- Return Date (approx updated_at of delivery or we need a proper event date?)
    -- Ideally we'd use the Event date, but for V1 View (simple), updated_at of delivery item is proxy?
    -- Issue: post-delivery return might happen days later.
    -- BETTER: Link to order_delivery_events if possible?
    -- Complexity: order_delivery_events doesn't link to ITEMS strictly rows.
    -- Compromise for MVP: Use 'updated_at' of delivery as proxy, or if we want strictness, assume delivery date for spot returns.
    -- For post-delivery returns, the 'updated_at' of the delivery record changes.
    d.sales_document_id as order_id,
    d.id as delivery_id,
    di.sales_document_item_id as item_ref_id,
    di.qty_returned,
    sdi.unit_price,
    (di.qty_returned * sdi.unit_price) as return_amount,
    sdi.item_id as product_id
FROM public.delivery_items di
JOIN public.deliveries d ON di.delivery_id = d.id
JOIN public.sales_document_items sdi ON di.sales_document_item_id = sdi.id
WHERE 
    d.status NOT IN ('cancelled')
    AND di.qty_returned > 0;

-- 3. DRE COGS V1 (Custo da Mercadoria Vendida)
-- Logic: + Cost of Goods Out (Sales Delivery)
--        - Cost of Goods In (Customer Return)
CREATE OR REPLACE VIEW public.dre_cogs_v1 AS
SELECT
    im.company_id,
    im.occurred_at::DATE as occurrence_date,
    im.reference_id as ref_id, -- Delivery ID usually
    im.item_id as product_id,
    im.qty_base as quantity,
    im.total_cost,
    CASE 
        WHEN im.movement_type = 'SAIDA' THEN 'COGS_OUT'
        WHEN im.movement_type = 'ENTRADA' THEN 'COGS_RETURN'
    END as type
FROM public.inventory_movements im
WHERE 
    (im.movement_type = 'SAIDA' AND im.reason = 'sales_delivery')
    OR
    (im.movement_type = 'ENTRADA' AND im.reason = 'customer_return');

-- 4. DRE Summarized V1
-- Aggregates everything by Day/Company
CREATE OR REPLACE VIEW public.dre_summary_v1 AS
WITH revenue AS (
    SELECT company_id, occurrence_date, SUM(revenue_amount) as total_revenue
    FROM public.dre_revenue_realized_v1
    GROUP BY company_id, occurrence_date
),
returns AS (
    SELECT company_id, occurrence_date, SUM(return_amount) as total_returns
    FROM public.dre_returns_v1
    GROUP BY company_id, occurrence_date
),
cogs AS (
    SELECT 
        company_id, 
        occurrence_date, 
        SUM(CASE WHEN type = 'COGS_OUT' THEN total_cost ELSE 0 END) as cogs_out,
        SUM(CASE WHEN type = 'COGS_RETURN' THEN total_cost ELSE 0 END) as cogs_return
    FROM public.dre_cogs_v1
    GROUP BY company_id, occurrence_date
)
SELECT
    COALESCE(r.occurrence_date, rt.occurrence_date, c.occurrence_date) as date,
    COALESCE(r.company_id, rt.company_id, c.company_id) as company_id,
    COALESCE(r.total_revenue, 0) as gross_revenue,
    COALESCE(rt.total_returns, 0) as deductions,
    (COALESCE(r.total_revenue, 0) - COALESCE(rt.total_returns, 0)) as net_revenue,
    (COALESCE(c.cogs_out, 0) - COALESCE(c.cogs_return, 0)) as cogs,
    (COALESCE(r.total_revenue, 0) - COALESCE(rt.total_returns, 0) - (COALESCE(c.cogs_out, 0) - COALESCE(c.cogs_return, 0))) as gross_profit
FROM revenue r
FULL OUTER JOIN returns rt ON r.company_id = rt.company_id AND r.occurrence_date = rt.occurrence_date
FULL OUTER JOIN cogs c ON COALESCE(r.company_id, rt.company_id) = c.company_id AND COALESCE(r.occurrence_date, rt.occurrence_date) = c.occurrence_date;

-- 5. Audit View: Stock Mismatch
-- Orders that have Delivery Qty but NO matching COGS Out
CREATE OR REPLACE VIEW public.audit_dre_stock_mismatch_v1 AS
SELECT
    d.sales_document_id,
    d.id as delivery_id,
    d.created_at,
    di.sales_document_item_id,
    di.qty_delivered,
    COALESCE(im_sum.qty_out, 0) as stock_qty_out,
    (di.qty_delivered - COALESCE(im_sum.qty_out, 0)) as discrepancy
FROM public.delivery_items di
JOIN public.deliveries d ON di.delivery_id = d.id
LEFT JOIN (
    SELECT reference_id, SUM(qty_base) as qty_out
    FROM public.inventory_movements
    WHERE reason = 'sales_delivery'
    GROUP BY reference_id
) im_sum ON d.id = im_sum.reference_id
WHERE d.status = 'delivered' AND (di.qty_delivered - COALESCE(im_sum.qty_out, 0)) > 0.001;

COMMIT;
