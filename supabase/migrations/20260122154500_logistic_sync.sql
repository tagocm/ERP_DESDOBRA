
-- Migration: Logistic Synchronization and Mandatory Audit
-- 1. Sync Function: Aggregates delivery statuses to update order status
-- 2. Audit Trigger: Enforces event recording for delivery changes

-- ============================================================================
-- 1. SYNC FUNCTION
-- ============================================================================

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
    -- Get current status
    SELECT status_logistic INTO v_current_status FROM sales_documents WHERE id = p_order_id;
    
    -- If order is not found or in a state that shouldn't be auto-updated (e.g. archaic), exit?
    -- No, we want to force sync if deliveries exist.
    
    -- Aggregate delivery stats
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status IN ('delivered', 'returned_total', 'cancelled')),
        COUNT(*) FILTER (WHERE status = 'delivered'),
        COUNT(*) FILTER (WHERE status = 'returned_total'),
        COUNT(*) FILTER (WHERE status IN ('in_route', 'loaded')), -- Loaded is essentially ready/in-route context
        COUNT(*) FILTER (WHERE status IN ('pending', 'planned', 'separation'))
    INTO v_total, v_final, v_delivered, v_returned, v_in_route, v_pending
    FROM deliveries 
    WHERE sales_document_id = p_order_id;

    -- If no deliveries, do not touch (could be manual workflow or pre-delivery)
    IF v_total = 0 THEN
        RETURN;
    END IF;

    -- LOGIC RULES
    -- 1. If ANY is in_route -> Order is 'em_rota' (Keep it active until all done)
    -- 2. If ALL are final:
    --    a. If ALL delivered -> 'entregue'
    --    b. If ALL returned -> 'devolvido' (new status? or 'nao_entregue')
    --    c. Mixed -> 'entregue_parcial' (if supported) OR 'entregue' with flag?
    --       Let's map to existing enums: pending, separation, expedition, em_rota, handed_over(entregue), returned(nao_entregue)?
    --       Checking CHECK constraint from likely schema:
    --       status_logistic IN ('pending', 'separation', 'expedition', 'em_rota', 'entregue', 'nao_entregue')
    
    IF v_in_route > 0 THEN
        v_new_status := 'em_rota';
    ELSIF v_pending > 0 THEN
        -- Still has pending stuff. If some are final, it's 'em_rota' (waiting rest) or 'expedition'? 
        -- Safer to keep 'expedition' or 'em_rota'. Let's say 'em_rota' if at least one was attempted?
        IF v_final > 0 THEN
            v_new_status := 'em_rota';
        ELSE
            -- All pending or planned
            v_new_status := 'expedition'; -- or keep current if it was separation?
            -- Actually, don't revert progress.
            IF v_current_status IN ('em_rota', 'entregue') THEN
                 v_new_status := 'em_rota'; -- Don't go back to expedition
            ELSE
                 v_new_status := 'expedition';
            END IF;
        END IF;
    ELSIF v_final = v_total THEN
        -- All done
        IF v_delivered = v_total THEN
            v_new_status := 'entregue';
        ELSIF v_returned = v_total THEN
            v_new_status := 'nao_entregue';
        ELSE
            -- Mixed (Partially delivered, partially returned)
            v_new_status := 'entregue'; -- Mark as delivered implies "Process Complete" usually
            -- Or we need a detailed status. For now 'entregue' + flags usually.
        END IF;
    ELSE
        -- Fallback
        v_new_status := 'em_rota';
    END IF;

    -- Update if changed
    IF v_new_status IS DISTINCT FROM v_current_status THEN
        UPDATE sales_documents 
        SET status_logistic = v_new_status,
            updated_at = NOW()
        WHERE id = p_order_id;
        
        -- Log internal verification
        INSERT INTO sales_document_history (document_id, event_type, description, metadata)
        VALUES (p_order_id, 'logistic_sync', 'Status logístico sincronizado com entregas.', 
                jsonb_build_object('old', v_current_status, 'new', v_new_status, 'stats', 
                        jsonb_build_object('total', v_total, 'delivered', v_delivered, 'returned', v_returned)
                ));
                
        -- Additional Hook: If Closed (entregue/nao_entregue), maybe trigger "Close Balance"?
        -- Not yet implemented automatically, risk of cascade.
    END IF;
END;
$$;

-- ============================================================================
-- 2. TRIGGER ON DELIVERIES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_sync_logistic_status()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.sync_order_logistic_status(NEW.sales_document_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deliveries_sync_status ON deliveries;
CREATE TRIGGER trg_deliveries_sync_status
    AFTER INSERT OR UPDATE OF status ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_sync_logistic_status();

-- ============================================================================
-- 3. AUDIT ENFORCEMENT (Helper / Optional Trigger)
-- ============================================================================
-- Ensure key transitions are logged in order_delivery_events

CREATE OR REPLACE FUNCTION public.trigger_audit_delivery_events()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changed to a final state
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('delivered', 'returned_total', 'returned_partial') THEN
        INSERT INTO order_delivery_events (
            company_id,
            order_id,
            route_id,
            event_type,
            payload,
            created_at
        ) VALUES (
            NEW.company_id,
            NEW.sales_document_id,
            NEW.route_id,
            CASE 
                WHEN NEW.status = 'delivered' THEN 'ENTREGA_CONCLUIDA'
                WHEN NEW.status LIKE 'returned%' THEN 'DEVOLUCAO_REGISTRADA'
                ELSE 'STATUS_ALTERADO'
            END,
            jsonb_build_object(
                'delivery_id', NEW.id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'automatic', true
            ),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deliveries_audit ON deliveries;
CREATE TRIGGER trg_deliveries_audit
    AFTER UPDATE OF status ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_audit_delivery_events();

