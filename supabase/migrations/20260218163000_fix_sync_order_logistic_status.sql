-- Migration: Fix Sync Order Logistic Status Function
-- Description: Updates sync_order_logistic_status to use English enum values and explicit casting
-- to prevent type errors when synchronizing delivery status to sales order status.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_order_logistic_status(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_total INT;
    v_final INT;  -- delivered, returned_total, cancelled
    v_delivered INT;
    v_returned INT;
    v_in_route INT;
    v_pending INT;
    v_new_status TEXT;
    v_current_status TEXT;
BEGIN
    -- Get current status (cast to text for comparison)
    SELECT status_logistic::text INTO v_current_status FROM sales_documents WHERE id = p_order_id;
    
    -- Aggregate delivery stats
    -- Note: deliveries.status is typically text or enum. Assuming English values from route.ts ('in_route', 'draft', etc.)
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status IN ('delivered', 'returned_total', 'cancelled', 'completed')),
        COUNT(*) FILTER (WHERE status = 'delivered' OR status = 'completed'),
        COUNT(*) FILTER (WHERE status IN ('returned_total', 'returned_partial')),
        COUNT(*) FILTER (WHERE status IN ('in_route', 'loaded')),
        COUNT(*) FILTER (WHERE status IN ('pending', 'planned', 'draft', 'separation'))
    INTO v_total, v_final, v_delivered, v_returned, v_in_route, v_pending
    FROM deliveries 
    WHERE sales_document_id = p_order_id
    AND status != 'cancelled'; -- Ignore cancelled deliveries from count? Or include? Adjust logic as needed.

    -- If no active deliveries, return
    IF v_total = 0 THEN
        RETURN;
    END IF;

    -- LOGIC RULES (Mapping to sales_logistic_status_en)
    -- 'pending', 'routed', 'scheduled', 'expedition', 'in_route', 'delivered', 'not_delivered', 'returned', 'partial', 'cancelled'

    IF v_in_route > 0 THEN
        v_new_status := 'in_route';
    ELSIF v_pending > 0 THEN
        IF v_final > 0 THEN
             -- Mixed final + pending = in_route (still active)
            v_new_status := 'in_route';
        ELSE
            -- All pending -> expedition or routed?
            -- If previously in_route or delivered, keep in_route (don't revert to earlier stages easily)
            IF v_current_status IN ('in_route', 'delivered', 'returned', 'partial') THEN
                 v_new_status := 'in_route';
            ELSE
                 v_new_status := 'expedition'; -- Default fallback for pending deliveries
            END IF;
        END IF;
    ELSIF v_final = v_total THEN
        -- All done
        IF v_delivered = v_total THEN
            v_new_status := 'delivered';
        ELSIF v_returned = v_total THEN
            v_new_status := 'returned';
        ELSE
            -- Mixed delivered/returned
            v_new_status := 'partial'; -- Use 'partial' or 'delivered' depending on business rule. Mapping to 'partial' or 'delivered'.
        END IF;
    ELSE
        -- Fallback
        v_new_status := 'in_route';
    END IF;

    -- Update if changed
    IF v_new_status IS DISTINCT FROM v_current_status THEN
        UPDATE sales_documents 
        SET status_logistic = v_new_status::sales_logistic_status_en,
            updated_at = NOW()
        WHERE id = p_order_id;
        
        -- Log internal verification
        INSERT INTO sales_document_history (document_id, event_type, description, metadata)
        VALUES (p_order_id, 'logistic_sync', 'Status logístico sincronizado com entregas (Fix EN).', 
                jsonb_build_object('old', v_current_status, 'new', v_new_status, 'stats', 
                        jsonb_build_object('total', v_total, 'delivered', v_delivered, 'returned', v_returned)
                ));
    END IF;
END;
$$;

COMMIT;
