
-- Fix Bug in sync_order_logistic_status
-- 'loaded' is not a valid delivery_status enum value, causing crashes.

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
    v_new_status TEXT;
    v_current_status TEXT;
BEGIN
    -- Get current status
    SELECT status_logistic INTO v_current_status FROM sales_documents WHERE id = p_order_id;
    
    -- Aggregate delivery stats
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status IN ('delivered', 'returned_total', 'cancelled')),
        COUNT(*) FILTER (WHERE status = 'delivered'),
        COUNT(*) FILTER (WHERE status = 'returned_total'),
        COUNT(*) FILTER (WHERE status IN ('in_route')), -- REMOVED 'loaded' (invalid enum)
        COUNT(*) FILTER (WHERE status IN ('draft', 'in_preparation')) -- Added draft/in_preparation
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
                 v_new_status := 'roteirizado'; -- Was 'expedition' (invalid)
            END IF;
        END IF;
    ELSIF v_final = v_total THEN
        IF v_delivered = v_total THEN
            v_new_status := 'entregue';
        ELSIF v_returned = v_total THEN
            v_new_status := 'devolvido'; -- Was 'nao_entregue' (invalid)
        ELSE
            v_new_status := 'parcial'; -- Was 'entregue', mapped to 'parcial' for mixed state
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
