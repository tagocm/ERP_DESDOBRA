-- Migration: DRE Views V2
-- Description: Refined logic to separate Operational Refusals from Financial Returns.
-- Strategy: Returns (DRE) must be backed by 'customer_return' stock movements to avoid counting spot refusals.

BEGIN;

-- 1. DRE Revenue Realized V2 (Same as V1 but explicit on status)
-- Logic: Gross Revenue = What was physically delivered and accepted.
CREATE OR REPLACE VIEW public.dre_revenue_realized_v2 AS
SELECT
    di.company_id,
    d.created_at::DATE as occurrence_date,
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
    d.status NOT IN ('cancelled', 'draft', 'in_preparation')
    AND di.qty_delivered > 0;

-- 2. DRE Returns V2 (Financial Deduction)
-- Logic: Only count returns that generated a 'customer_return' stock verification.
-- This filters out "Spot Refusals" which might set qty_returned but imply no sale happened.
CREATE OR REPLACE VIEW public.dre_returns_v2 AS
SELECT
    im.company_id,
    im.occurred_at::DATE as occurrence_date,
    d.sales_document_id as order_id,
    d.id as delivery_id,
    sdi.id as item_ref_id,
    im.qty_base as qty_returned, -- Use Stock Movement Qty as the financial truth
    sdi.unit_price,
    (im.qty_base * sdi.unit_price) as return_amount,
    sdi.item_id as product_id
FROM public.inventory_movements im
JOIN public.deliveries d ON im.reference_id = d.id AND im.reference_type = 'delivery'
JOIN public.sales_document_items sdi ON sdi.item_id = im.item_id AND sdi.document_id = d.sales_document_id
WHERE 
    im.movement_type = 'ENTRADA' 
    AND im.reason = 'customer_return';

-- 3. DRE Refusals V1 (Operational Metrics - Not Financial Return)
-- Logic: Everything in delivery_items.qty_returned that IS NOT in DRE Returns V2.
-- Useful for Logistics Quality Index.
CREATE OR REPLACE VIEW public.dre_refusals_logistics_v1 AS
SELECT
    di.company_id,
    d.updated_at::DATE as occurrence_date,
    d.sales_document_id as order_id,
    d.id as delivery_id,
    di.sales_document_item_id,
    di.qty_returned
FROM public.delivery_items di
JOIN public.deliveries d ON di.delivery_id = d.id
LEFT JOIN public.dre_returns_v2 rv2 ON rv2.delivery_id = di.delivery_id AND rv2.item_ref_id = di.sales_document_item_id
WHERE 
    di.qty_returned > 0
    AND rv2.delivery_id IS NULL; -- Exclude confirmed financial returns

-- 4. DRE Summary V2
CREATE OR REPLACE VIEW public.dre_summary_v2 AS
WITH revenue AS (
    SELECT company_id, occurrence_date, SUM(revenue_amount) as total_revenue
    FROM public.dre_revenue_realized_v2
    GROUP BY company_id, occurrence_date
),
returns AS (
    SELECT company_id, occurrence_date, SUM(return_amount) as total_returns
    FROM public.dre_returns_v2
    GROUP BY company_id, occurrence_date
),
cogs AS (
    SELECT 
        company_id, 
        occurrence_date, 
        SUM(CASE WHEN type = 'COGS_OUT' THEN total_cost ELSE 0 END) as cogs_out,
        SUM(CASE WHEN type = 'COGS_RETURN' THEN total_cost ELSE 0 END) as cogs_return
    FROM public.dre_cogs_v1 -- V1 is good for COGS derived from stock
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

-- 5. Audit Views (Gaps)

-- A) Returns without Stock Movement (Likely Refusals that confused the system or data errors)
CREATE OR REPLACE VIEW public.audit_dre_return_stock_mismatch_v1 AS
SELECT 
    di.company_id, 
    di.delivery_id, 
    di.sales_document_item_id, 
    di.qty_returned
FROM public.delivery_items di
LEFT JOIN public.dre_returns_v2 rv2 ON di.delivery_id = rv2.delivery_id AND di.sales_document_item_id = rv2.item_ref_id
WHERE di.qty_returned > 0 AND rv2.delivery_id IS NULL;

-- B) Stock Return Orphan (Stock came back, but no Sales Order Item linked?)
CREATE OR REPLACE VIEW public.audit_dre_stock_return_orphan_v1 AS
SELECT
    im.company_id,
    im.id as movement_id,
    im.reference_id as delivery_id
FROM public.inventory_movements im
LEFT JOIN public.deliveries d ON im.reference_id = d.id
WHERE im.movement_type = 'ENTRADA' AND im.reason = 'customer_return' AND d.id IS NULL;

-- C) Zero Cost Audit
CREATE OR REPLACE VIEW public.audit_dre_cost_zero_v1 AS
SELECT
    im.company_id,
    im.id,
    im.reason,
    im.item_id,
    im.total_cost
FROM public.inventory_movements im
WHERE 
    im.reason IN ('sales_delivery', 'customer_return') 
    AND im.total_cost = 0;

COMMIT;
