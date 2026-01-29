
-- Fix Sync Logic: Check Quantities
-- Prevents marking order as 'entregue' if total delivered quantity < total ordered quantity.

CREATE OR REPLACE FUNCTION public.sync_order_logistic_status(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_total INT;
    v_final INT;
    v_delivered INT;
    v_returned INT;
    v_in_route INT;
    v_pending INT;
    
    v_qty_ordered NUMERIC;
    v_qty_delivered NUMERIC;
    
    v_new_status TEXT;
    v_current_status TEXT;
BEGIN
    -- Get current status
    SELECT status_logistic INTO v_current_status FROM sales_documents WHERE id = p_order_id;
    
    -- Get Quantities
    SELECT COALESCE(SUM(quantity), 0) INTO v_qty_ordered 
    FROM sales_document_items WHERE document_id = p_order_id;
    
    SELECT COALESCE(SUM(di.qty_delivered), 0) INTO v_qty_delivered
    FROM delivery_items di
    JOIN deliveries d ON d.id = di.delivery_id
    WHERE d.sales_document_id = p_order_id
    AND d.status IN ('delivered', 'delivered_partial'); -- Only count effective deliveries

    -- Aggregate delivery stats
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status IN ('delivered', 'returned_total', 'cancelled')),
        COUNT(*) FILTER (WHERE status = 'delivered'),
        COUNT(*) FILTER (WHERE status = 'returned_total'),
        COUNT(*) FILTER (WHERE status IN ('in_route')), 
        COUNT(*) FILTER (WHERE status IN ('draft', 'in_preparation')) 
    INTO v_total, v_final, v_delivered, v_returned, v_in_route, v_pending
    FROM deliveries 
    WHERE sales_document_id = p_order_id;

    -- If no deliveries, do not touch
    IF v_total = 0 THEN
        RETURN;
    END IF;

    -- LOGIC RULES
    IF v_in_route > 0 THEN
        v_new_status := 'em_rota';
    ELSIF v_pending > 0 THEN
        IF v_final > 0 THEN
            v_new_status := 'em_rota';
        ELSE
            IF v_current_status IN ('em_rota', 'entregue') THEN
                 v_new_status := 'em_rota';
            ELSE
                 v_new_status := 'roteirizado';
            END IF;
        END IF;
    ELSIF v_final = v_total THEN
        -- All deliveries are final (delivered, returned, cancelled)
        
        -- CHECK QUANTITY COMPLETENESS
        -- Tolerance 0.01 for floating point
        IF v_qty_delivered >= (v_qty_ordered - 0.01) THEN
             IF v_returned > 0 AND v_delivered = 0 THEN
                 v_new_status := 'devolvido'; -- All returned
             ELSE
                 v_new_status := 'entregue'; -- Fully delivered (or mixed but total qty met)
             END IF;
        ELSE
             -- Quantity NOT met.
             -- If we have delivered at least something -> 'parcial'
             IF v_qty_delivered > 0 THEN
                 v_new_status := 'parcial';
             ELSE
                 -- Nothing delivered (all returned or cancelled)
                 v_new_status := 'devolvido';
             END IF;
        END IF;
        
    ELSE
        v_new_status := 'em_rota';
    END IF;

    -- Update if changed
    IF v_new_status IS DISTINCT FROM v_current_status THEN
        UPDATE sales_documents 
        SET status_logistic = v_new_status,
            updated_at = NOW()
        WHERE id = p_order_id;
    END IF;
END;
$$;
