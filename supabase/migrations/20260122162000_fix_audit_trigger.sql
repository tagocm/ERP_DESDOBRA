
-- Fix Audit Trigger: Cannot use LIKE on Enum
-- Replace LIKE 'returned%' with explicit IN check

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
                WHEN NEW.status = 'delivered' THEN 'ENTREGA_SUCESSO'
                WHEN NEW.status = 'returned_total' THEN 'DEVOLUCAO_TOTAL'
                WHEN NEW.status = 'returned_partial' THEN 'ENTREGA_PARCIAL' -- Mapped to existing allowed value
                ELSE 'ENTREGA_SUCESSO' -- Fallback to a valid safe value or avoid insert
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
