-- ========================================================================
-- Relax Financial Delete Triggers to allow Sync
-- ========================================================================
-- This migration modifies the delete protection triggers to allow 
-- hard deletion of installments WHEN the event is still mutable (pending).
-- This is necessary for the "Delete All -> Insert New" sync strategy.
-- ========================================================================

-- 1. Relax Installment Deletion
CREATE OR REPLACE FUNCTION prevent_financial_event_installments_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_event_status TEXT;
BEGIN
    -- Allow deletion if the parent event is in a mutable state
    -- We need to fetch the status of the parent event
    SELECT status INTO v_event_status
    FROM financial_events
    WHERE id = OLD.event_id;

    -- If event is pending or attention, allow delete (for sync purposes)
    IF v_event_status IN ('pending', 'attention') THEN
        RETURN OLD;
    END IF;

    -- Even if event is not found (orphan installment?), arguably we should allow delete, 
    -- but let's be strict for safety. If v_event_status is NULL, we block.
    
    RAISE EXCEPTION 'Registros de parcelas financeiras não podem ser excluídos se o evento não estiver pendente. Status atual: %', v_event_status;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Relax Event Deletion (Optional but good for consistency)
-- If an event is 'pending' and has no dependencies (checked by FKs usually), 
-- allowing delete might be useful for cleanup scripts.
CREATE OR REPLACE FUNCTION prevent_financial_events_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow delete if pending
    IF OLD.status IN ('pending', 'attention') THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Registros de eventos financeiros só podem ser excluídos se estiverem pendentes. Status: %', OLD.status;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
