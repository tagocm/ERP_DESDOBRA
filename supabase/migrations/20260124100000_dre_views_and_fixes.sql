-- Migration: DRE Views, Audit & Fixes
-- Author: Antigravity
-- Date: 2026-01-24

-- ============================================================================
-- PART 1: FIX TRIGGER (Enable Cost Capture & Standardization)
-- ============================================================================

-- ============================================================================
-- PART 1: FIX STOCK DEDUCTION (Enable Cost Capture & Standardization)
-- Strategy: Update `deduct_stock_from_route` to capture Avg Cost and use Standard Reason.
--          (We do NOT use the trigger anymore, as it looked at Planned Qty, not Loaded Qty).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.deduct_stock_from_route(p_route_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    r_delivery RECORD;
    r_item RECORD;
    v_source_ref TEXT;
    v_unit_cost NUMERIC;
BEGIN
    FOR r_delivery IN
        SELECT * FROM public.deliveries WHERE route_id = p_route_id
    LOOP
        v_source_ref := concat('Entrega #', r_delivery.number);

        FOR r_item IN
            SELECT di.*, sdi.item_id, i.avg_cost
            FROM public.delivery_items di
            JOIN public.sales_document_items sdi ON sdi.id = di.sales_document_item_id
            LEFT JOIN public.items i ON sdi.item_id = i.id
            WHERE di.delivery_id = r_delivery.id
        LOOP
            -- Get Unit Cost (Snapshot or Current Avg)
            v_unit_cost := COALESCE(r_item.avg_cost, 0);

            -- Check if movement exists
            IF NOT EXISTS (
                SELECT 1 FROM public.inventory_movements
                WHERE reference_type = 'delivery_item'
                AND reference_id = r_item.id
                AND movement_type = 'SAIDA'
            ) THEN
                -- Insert SAIDA with correct Cost and Reason
                INSERT INTO public.inventory_movements (
                    company_id,
                    item_id,
                    movement_type,
                    qty_base,
                    reference_type,
                    reference_id,
                    source_ref,
                    notes,
                    created_by,
                    created_at,
                    updated_at,
                    occurred_at,
                    reason,
                    qty_in,
                    qty_out,
                    unit_cost,
                    total_cost
                ) VALUES (
                    r_delivery.company_id,
                    r_item.item_id,
                    'SAIDA',
                    -1 * r_item.qty_loaded, 
                    'delivery_item',
                    r_item.id,
                    v_source_ref,
                    'Baixa por entrega em rota (DRE)',
                    p_user_id,
                    NOW(),
                    NOW(),
                    NOW(),
                    'sales_delivery', -- STANDARD REASON
                    0,
                    r_item.qty_loaded,
                    v_unit_cost,
                    r_item.qty_loaded * v_unit_cost
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure Trigger is DROPPED to avoid double deduction
DROP TRIGGER IF EXISTS trg_sales_order_logistic_change_stock ON public.sales_documents;
DROP FUNCTION IF EXISTS public.handle_sales_order_logistic_change_stock();

-- Use a safe multiplication helper if needed, or just standard *
-- Standard * is fine as we COALESCE avg_cost to 0.




-- ============================================================================
-- PART 2: DRE VIEWS (Source of Truth)
-- ============================================================================

-- 2.1 Receita de Mercadorias Entregues (Gross Revenue Delivered)
CREATE OR REPLACE VIEW public.v_dre_receita_mercadorias_entregue AS
SELECT 
    d.company_id,
    d.updated_at::DATE as date_ref, -- Using delivery confirmation date
    sdi.item_id,
    i.name as item_name,
    d.sales_document_id,
    sd.client_id,
    c.trade_name as client_name,
    SUM(di.qty_delivered) as qty_delivered,
    sdi.unit_price,
    SUM(di.qty_delivered * sdi.unit_price) as gross_revenue
FROM public.deliveries d
JOIN public.delivery_items di ON d.id = di.delivery_id
JOIN public.sales_document_items sdi ON di.sales_document_item_id = sdi.id
JOIN public.sales_documents sd ON d.sales_document_id = sd.id
LEFT JOIN public.items i ON sdi.item_id = i.id
LEFT JOIN public.organizations c ON sd.client_id = c.id
WHERE d.status IN ('delivered', 'delivered_partial', 'returned_partial') -- Only confirmed deliveries
GROUP BY 
    d.company_id, d.updated_at::DATE, sdi.item_id, i.name, d.sales_document_id, sd.client_id, c.trade_name, sdi.unit_price;

-- 2.2 Devoluções (Returns Revenue Reversal)
CREATE OR REPLACE VIEW public.v_dre_devolucoes_mercadorias_recebidas AS
SELECT 
    d.company_id,
    d.updated_at::DATE as date_ref,
    sdi.item_id,
    i.name as item_name,
    d.sales_document_id,
    sd.client_id,
    SUM(di.qty_returned) as qty_returned,
    sdi.unit_price,
    SUM(di.qty_returned * sdi.unit_price) as revenue_reversal
FROM public.deliveries d
JOIN public.delivery_items di ON d.id = di.delivery_id
JOIN public.sales_document_items sdi ON di.sales_document_item_id = sdi.id
JOIN public.sales_documents sd ON d.sales_document_id = sd.id
LEFT JOIN public.items i ON sdi.item_id = i.id
WHERE d.status IN ('returned_total', 'returned_partial') -- Returns
      AND di.qty_returned > 0
GROUP BY 
    d.company_id, d.updated_at::DATE, sdi.item_id, i.name, d.sales_document_id, sd.client_id, sdi.unit_price;

-- 2.3 CMV (Cost of Goods Sold - Delivered)
CREATE OR REPLACE VIEW public.v_dre_cmv_entregue AS
SELECT 
    im.company_id,
    im.occurred_at::DATE as date_ref,
    im.item_id,
    SUM(im.qty_out) as qty_sold,
    SUM(im.total_cost) as cogs_amount
FROM public.inventory_movements im
WHERE im.movement_type = 'SAIDA' 
  AND im.reason IN ('sale_out', 'sales_delivery') -- Support both legacy and new standard
GROUP BY im.company_id, im.occurred_at::DATE, im.item_id;


-- 2.4 DRE Resumo (Summary)
CREATE OR REPLACE VIEW public.v_dre_resumo AS
SELECT
    COALESCE(r.company_id, dev.company_id) as company_id,
    COALESCE(r.date_ref, dev.date_ref) as date_ref,
    COALESCE(SUM(r.gross_revenue), 0) as receita_bruta,
    COALESCE(SUM(dev.revenue_reversal), 0) as devolucoes,
    (COALESCE(SUM(r.gross_revenue), 0) - COALESCE(SUM(dev.revenue_reversal), 0)) as receita_liquida,
    (
        -- Approximate CMV logic for Summary (Full implementation would join item-level CMV)
        -- Here we assume CMV View matches date_ref, which works for triggered events
        -- Ideally we aggregate CMV view separately and join.
        0 -- Placeholder: requires complex join on dates or lateral
    ) as cmv_estimado
FROM public.v_dre_receita_mercadorias_entregue r
FULL OUTER JOIN public.v_dre_devolucoes_mercadorias_recebidas dev 
    ON r.company_id = dev.company_id AND r.date_ref = dev.date_ref
GROUP BY COALESCE(r.company_id, dev.company_id), COALESCE(r.date_ref, dev.date_ref);


-- ============================================================================
-- PART 3: AUDIT VIEWS (Consistency Checks)
-- ============================================================================

-- 3.1 Deliveries without Stock Outflow
CREATE OR REPLACE VIEW public.v_audit_delivery_sem_saida_estoque AS
SELECT 
    d.id as delivery_id,
    d.sales_document_id,
    d.updated_at as delivery_date,
    sd.document_number,
    -- Check if ANY outflow exists for this order
    NOT EXISTS (
        SELECT 1 FROM public.inventory_movements im 
        WHERE im.reference_type = 'pedido' 
        AND im.reference_id = d.sales_document_id 
        AND im.movement_type = 'SAIDA'
    ) as missing_stock_movement
FROM public.deliveries d
JOIN public.sales_documents sd ON d.sales_document_id = sd.id
WHERE d.status IN ('delivered', 'returned_partial')
AND NOT EXISTS (
    SELECT 1 FROM public.inventory_movements im 
    WHERE im.reference_type = 'pedido' 
    AND im.reference_id = d.sales_document_id 
    AND im.movement_type = 'SAIDA'
);

-- 3.2 Returns without Stock Inflow
CREATE OR REPLACE VIEW public.v_audit_devolucao_sem_entrada_estoque AS
SELECT 
    d.id as delivery_id,
    d.sales_document_id,
    d.updated_at as return_date,
    sd.document_number,
    di.qty_returned,
    sdi.item_id
FROM public.deliveries d
JOIN public.delivery_items di ON d.id = di.delivery_id
JOIN public.sales_documents sd ON d.sales_document_id = sd.id
JOIN public.sales_document_items sdi ON di.sales_document_item_id = sdi.id
WHERE d.status IN ('returned_total', 'returned_partial')
AND di.qty_returned > 0
AND NOT EXISTS (
    SELECT 1 FROM public.inventory_movements im 
    WHERE im.reference_type = 'pedido' 
    AND im.reference_id = d.sales_document_id 
    AND im.movement_type = 'ENTRADA'
    AND im.item_id = sdi.item_id
    -- AND im.occurred_at >= d.updated_at -- Strictness optional
);

-- 3.3 Movement without Reference
CREATE OR REPLACE VIEW public.v_audit_movimento_sem_referencia AS
SELECT * 
FROM public.inventory_movements 
WHERE reason IN ('sales_delivery', 'sale_out', 'customer_return', 'return_in')
AND (reference_id IS NULL OR reference_type IS NULL);


-- Final Notification
NOTIFY pgrst, 'reload schema';
