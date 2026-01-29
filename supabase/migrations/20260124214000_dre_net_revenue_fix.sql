-- Migration: DRE Revenue Net Price Alignment
-- Description: ALIGNS Revenue and Returns to use the same Net Price logic (Item Net - Header Discount Apportionment).
--              Establishes dre_item_prices_v1 as the pricing source of truth.

BEGIN;

-- 1. Helper View: Item Prices (Net vs Gross Calculation)
-- Centralizes the math so Revenue and Returns always match basic valuation.
CREATE OR REPLACE VIEW public.dre_item_prices_v1 AS
SELECT 
    sdi.id as item_id,
    sdi.document_id,
    sdi.item_id as product_id,
    sdi.quantity,
    sdi.unit_price as gross_unit_price,
    sdi.total_amount as item_base_total, -- (Qty * Unit) - ItemDiscount
    sd.subtotal_amount as order_subtotal,
    COALESCE(sd.discount_amount, 0) as header_discount,
    
    -- Calculated Net Unit Price
    CASE 
        WHEN sdi.quantity = 0 THEN 0
        WHEN COALESCE(sd.subtotal_amount, 0) = 0 THEN 
            -- Fallback if subtotal is missing/zero: just use item total / qty (Item Discount only)
            sdi.total_amount / GREATEST(sdi.quantity, 1)
        ELSE 
            (
                sdi.total_amount - 
                ( (sdi.total_amount / sd.subtotal_amount) * COALESCE(sd.discount_amount, 0) )
            ) / sdi.quantity
    END::NUMERIC(15,2) as net_unit_price
FROM public.sales_document_items sdi
JOIN public.sales_documents sd ON sdi.document_id = sd.id;

-- 2. DRE Revenue Realized V2 (NET)
-- Now uses Net Unit Price.
CREATE OR REPLACE VIEW public.dre_revenue_realized_v2 AS
SELECT
    di.company_id,
    d.created_at::DATE as occurrence_date,
    d.sales_document_id as order_id,
    d.id as delivery_id,
    di.sales_document_item_id as item_ref_id,
    di.qty_delivered,
    
    ip.net_unit_price as unit_price, -- NET
    (di.qty_delivered * ip.net_unit_price) as revenue_amount,
    
    sdi.item_id as product_id,
    d.route_id,
    ip.gross_unit_price as _info_gross_price -- Helper for debugging (Moved to end to preserve column order)
FROM public.delivery_items di
JOIN public.deliveries d ON di.delivery_id = d.id
JOIN public.sales_document_items sdi ON di.sales_document_item_id = sdi.id
JOIN public.dre_item_prices_v1 ip ON di.sales_document_item_id = ip.item_id
WHERE 
    d.status NOT IN ('cancelled', 'draft', 'in_preparation')
    AND di.qty_delivered > 0;

-- 3. DRE Returns V2 (NET)
-- Re-defined to use the same logic source (dre_item_prices_v1)
CREATE OR REPLACE VIEW public.dre_returns_v2 AS
SELECT
    im.company_id,
    im.occurred_at::DATE as occurrence_date,
    d.sales_document_id as order_id,
    d.id as delivery_id,
    sdi.id as item_ref_id,
    im.qty_base as qty_returned,
    
    ip.net_unit_price as unit_price, -- NET
    (im.qty_base * ip.net_unit_price) as return_amount,
    
    sdi.item_id as product_id
FROM public.inventory_movements im
JOIN public.deliveries d ON im.reference_id = d.id AND im.reference_type = 'delivery'
JOIN public.sales_document_items sdi ON sdi.item_id = im.item_id AND sdi.document_id = d.sales_document_id
JOIN public.dre_item_prices_v1 ip ON sdi.id = ip.item_id
WHERE 
    im.movement_type = 'ENTRADA' 
    AND im.reason = 'customer_return';

-- 4. DRE Revenue Gross V1 (Reporting Only)
-- Helpful to compare "What we moved" vs "What we billed (Net)"
CREATE OR REPLACE VIEW public.dre_revenue_gross_v1 AS
SELECT
    di.company_id,
    d.created_at::DATE as occurrence_date,
    d.sales_document_id as order_id,
    di.qty_delivered,
    ip.gross_unit_price,
    (di.qty_delivered * ip.gross_unit_price) as gross_revenue_amount
FROM public.delivery_items di
JOIN public.deliveries d ON di.delivery_id = d.id
JOIN public.dre_item_prices_v1 ip ON di.sales_document_item_id = ip.item_id
WHERE 
    d.status NOT IN ('cancelled', 'draft', 'in_preparation')
    AND di.qty_delivered > 0;

-- 5. Audit: Net vs Gross Gap
-- Shows how much "value" was lost to discounts per order


-- Optimized Audit View using columns from V2
CREATE OR REPLACE VIEW public.audit_dre_net_vs_gross_gap_v1 AS
SELECT
    r.company_id,
    r.order_id,
    SUM(r.revenue_amount) as total_net_revenue,
    SUM(r.qty_delivered * r._info_gross_price) as total_gross_revenue,
    (SUM(r.qty_delivered * r._info_gross_price) - SUM(r.revenue_amount)) as total_discount_gap
FROM public.dre_revenue_realized_v2 r
GROUP BY r.company_id, r.order_id;

-- 6. Audit: Price Mismatch (Hard Check)
-- Validates that Revenue View is indeed using the Net Price from the Price Logic View
DROP VIEW IF EXISTS public.audit_dre_price_source_mismatch_v1 CASCADE;
CREATE OR REPLACE VIEW public.audit_dre_price_source_mismatch_v1 AS
SELECT 
    r.company_id,
    r.delivery_id,
    r.item_ref_id,
    r.unit_price as used_price,
    ip.net_unit_price as source_truth_price,
    (r.unit_price - ip.net_unit_price) as discrepancy
FROM public.dre_revenue_realized_v2 r
JOIN public.dre_item_prices_v1 ip ON r.item_ref_id = ip.item_id
WHERE ABS(r.unit_price - ip.net_unit_price) > 0.001;

COMMIT;
