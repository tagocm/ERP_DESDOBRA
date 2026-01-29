-- Migration: DRE Returns Net Price Fix
-- Description: Updates Returns valuation to use Net Price (Item Total - Apportioned Header Discount)/Qty.
--              Includes Header Discount apportionment logic.

BEGIN;

-- Helper Logic (CTE style for reuse in views)
-- Base Net Price = (ItemTotal - (ItemShare * HeaderDiscount)) / Qty
-- ItemShare = ItemTotal / Subtotal

-- 1. Update DRE Returns V2
CREATE OR REPLACE VIEW public.dre_returns_v2 AS
WITH item_net_prices AS (
    SELECT 
        sdi.id as item_id,
        sdi.document_id,
        sdi.item_id as product_id,
        sdi.quantity,
        sdi.total_amount as item_total,    -- Already includes item discount
        sd.subtotal_amount as order_subtotal,
        COALESCE(sd.discount_amount, 0) as header_discount,
        
        -- Calculated Net Unit Price
        CASE 
            WHEN sdi.quantity = 0 THEN 0
            WHEN COALESCE(sd.subtotal_amount, 0) = 0 THEN 0 -- Avoid div by zero
            ELSE 
                (
                    sdi.total_amount - 
                    ( (sdi.total_amount / sd.subtotal_amount) * COALESCE(sd.discount_amount, 0) )
                ) / sdi.quantity
        END::NUMERIC(15,2) as net_unit_price
    FROM public.sales_document_items sdi
    JOIN public.sales_documents sd ON sdi.document_id = sd.id
)
SELECT
    im.company_id,
    im.occurred_at::DATE as occurrence_date,
    d.sales_document_id as order_id,
    d.id as delivery_id,
    sdi.id as item_ref_id,
    im.qty_base as qty_returned, -- The Source of Truth for Quantity
    inp.net_unit_price as unit_price, -- The Source of Truth for Valuation (Net)
    (im.qty_base * inp.net_unit_price) as return_amount,
    sdi.item_id as product_id
FROM public.inventory_movements im
JOIN public.deliveries d ON im.reference_id = d.id AND im.reference_type = 'delivery'
JOIN public.sales_document_items sdi ON sdi.item_id = im.item_id AND sdi.document_id = d.sales_document_id
JOIN item_net_prices inp ON sdi.id = inp.item_id
WHERE 
    im.movement_type = 'ENTRADA' 
    AND im.reason = 'customer_return';

-- 2. Update Audit Price Source Mismatch V1
-- Now comparing the View's Price (Used) vs the Expected Net Price (Calculated same way)
-- Using a slightly stricter check (0.01)
DROP VIEW IF EXISTS public.audit_dre_price_source_mismatch_v1 CASCADE;
CREATE OR REPLACE VIEW public.audit_dre_price_source_mismatch_v1 AS
WITH expected_logic AS (
    SELECT 
        sdi.id as item_id,
        CASE 
            WHEN sdi.quantity = 0 THEN 0
            WHEN COALESCE(sd.subtotal_amount, 0) = 0 THEN 0
            ELSE 
                (
                    sdi.total_amount - 
                    ( (sdi.total_amount / sd.subtotal_amount) * COALESCE(sd.discount_amount, 0) )
                ) / sdi.quantity
        END as expected_net_price
    FROM public.sales_document_items sdi
    JOIN public.sales_documents sd ON sdi.document_id = sd.id
)
SELECT
    rt.company_id,
    rt.delivery_id,
    rt.item_ref_id as sales_item_id,
    
    rt.unit_price as used_return_price,
    el.expected_net_price,
    
    (rt.unit_price - el.expected_net_price) as discrepancy,
    
    -- Metadata for debugging
    rt.qty_returned,
    (rt.unit_price * rt.qty_returned) as total_used,
    (el.expected_net_price * rt.qty_returned) as total_expected
    
FROM public.dre_returns_v2 rt
JOIN expected_logic el ON rt.item_ref_id = el.item_id
WHERE 
    ABS(rt.unit_price - el.expected_net_price) > 0.01;

COMMIT;
