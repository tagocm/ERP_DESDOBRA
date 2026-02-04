-- ========================================================================
-- Fix Re-confirmation Flow for Rejected Sales Orders
-- ========================================================================
-- This migration addresses critical gaps in the financial event lifecycle:
-- 1. Prevents hard deletion of financial records
-- 2. Ensures unique installments (no duplicates)
-- 3. Fixes trigger to reset rejected events to pending on re-confirmation
-- 4. Makes installment creation idempotent
-- ========================================================================

-- ========================================================================
-- SECTION 1: Prevent Hard Deletion of Financial Records
-- ========================================================================

-- Function to prevent deletion of financial events
CREATE OR REPLACE FUNCTION prevent_financial_events_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Registros de eventos financeiros não podem ser excluídos. Use status/cancelamento para inativar.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent deletion of financial_events
DROP TRIGGER IF EXISTS trg_prevent_financial_events_delete ON financial_events;
CREATE TRIGGER trg_prevent_financial_events_delete
    BEFORE DELETE ON financial_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_financial_events_delete();

-- Function to prevent deletion of financial event installments
CREATE OR REPLACE FUNCTION prevent_financial_event_installments_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Registros de parcelas financeiras não podem ser excluídos. Use status/cancelamento para inativar.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent deletion of financial_event_installments
DROP TRIGGER IF EXISTS trg_prevent_financial_event_installments_delete ON financial_event_installments;
CREATE TRIGGER trg_prevent_financial_event_installments_delete
    BEFORE DELETE ON financial_event_installments
    FOR EACH ROW
    EXECUTE FUNCTION prevent_financial_event_installments_delete();

COMMENT ON FUNCTION prevent_financial_events_delete() IS 'Prevents hard deletion of financial events - use status changes instead';
COMMENT ON FUNCTION prevent_financial_event_installments_delete() IS 'Prevents hard deletion of financial event installments - use status changes instead';

-- ========================================================================
-- SECTION 2: Ensure Unique Installments (Prevent Duplicates)
-- ========================================================================

-- Add unique constraint to prevent duplicate installment numbers for same event
-- Using DO block to make it idempotent (won't fail if constraint already exists)
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_event_installment_number'
    ) THEN
        ALTER TABLE financial_event_installments
        ADD CONSTRAINT unique_event_installment_number 
        UNIQUE (event_id, installment_number);
    END IF;
END $$;

COMMENT ON CONSTRAINT unique_event_installment_number ON financial_event_installments IS 
'Ensures each installment number is unique per event, preventing duplicates during re-confirmation';

-- ========================================================================
-- SECTION 3: Fix Trigger to Reset Rejected Events on Re-confirmation
-- ========================================================================

-- Replace the existing trigger function with fixed logic
CREATE OR REPLACE FUNCTION public.handle_sales_event_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_partner_name TEXT;
    v_op_status TEXT;
BEGIN
    -- Determine Operational Status (use Logistic Status if Commercial is Confirmed, else Commercial)
    v_op_status := CASE 
        WHEN NEW.status_commercial = 'confirmed' THEN NEW.status_logistic 
        ELSE NEW.status_commercial 
    END;

    -- TRIGGER 1: CREATE EVENT ON CONFIRMATION
    -- If status_commercial becomes 'confirmed' (and wasn't before)
    IF NEW.status_commercial = 'confirmed' AND (OLD.status_commercial IS DISTINCT FROM 'confirmed') THEN
        
        -- Get partner name
        SELECT trade_name INTO v_partner_name 
        FROM organizations 
        WHERE id = NEW.client_id;
        
        -- Create/Upsert Financial Event with SMART RESET LOGIC
        INSERT INTO financial_events (
            company_id,
            origin_type,
            origin_id,
            origin_reference,
            partner_id,
            partner_name,
            direction,
            issue_date,
            total_amount,
            status,
            operational_status
        )
        VALUES (
            NEW.company_id,
            'SALE',
            NEW.id,
            'Pedido #' || NEW.document_number,
            NEW.client_id,
            COALESCE(v_partner_name, 'Cliente não identificado'),
            'AR',
            COALESCE(NEW.date_issued, CURRENT_DATE),
            COALESCE(NEW.total_amount, 0),
            'pending',
            v_op_status
        )
        ON CONFLICT (company_id, origin_type, origin_id) 
        DO UPDATE SET 
            -- Always update these fields
            total_amount = EXCLUDED.total_amount,
            operational_status = EXCLUDED.operational_status,
            updated_at = NOW(),
            
            -- SMART STATUS RESET: Reset rejected events to pending, preserve approved
            status = CASE
                WHEN financial_events.status = 'rejected' THEN 'pending'
                WHEN financial_events.status = 'approved' THEN 'approved'  -- Never reset approved
                ELSE financial_events.status  -- Keep current status for other cases
            END,
            
            -- Clear rejection fields when resetting rejected events
            rejected_by = CASE
                WHEN financial_events.status = 'rejected' THEN NULL
                ELSE financial_events.rejected_by
            END,
            rejected_at = CASE
                WHEN financial_events.status = 'rejected' THEN NULL
                ELSE financial_events.rejected_at
            END,
            rejection_reason = CASE
                WHEN financial_events.status = 'rejected' THEN NULL
                ELSE financial_events.rejection_reason
            END,
            
            -- Clear attention fields when resetting rejected events
            attention_marked_by = CASE
                WHEN financial_events.status = 'rejected' THEN NULL
                ELSE financial_events.attention_marked_by
            END,
            attention_marked_at = CASE
                WHEN financial_events.status = 'rejected' THEN NULL
                ELSE financial_events.attention_marked_at
            END,
            attention_reason = CASE
                WHEN financial_events.status = 'rejected' THEN NULL
                ELSE financial_events.attention_reason
            END;
        
        -- Create default installments only if new event (checked via existence)
        -- Use IDEMPOTENT logic with ON CONFLICT
        IF NOT EXISTS (
            SELECT 1 FROM financial_event_installments fei
            JOIN financial_events fe ON fe.id = fei.event_id
            WHERE fe.origin_type = 'SALE' AND fe.origin_id = NEW.id
        ) THEN
             DECLARE
                v_default_account UUID;
                v_default_cc UUID;
                v_payment_term_name TEXT;
                v_payment_mode_name TEXT;
                v_has_sales_installments BOOLEAN;
             BEGIN
                -- Fetch Defaults
                SELECT id INTO v_default_account FROM gl_accounts WHERE company_id = NEW.company_id AND code = '3.01.01' LIMIT 1;
                SELECT id INTO v_default_cc FROM cost_centers WHERE company_id = NEW.company_id AND code = '001' LIMIT 1;
                
                -- Fetch Payment Term Name
                IF NEW.payment_terms_id IS NOT NULL THEN
                    SELECT name INTO v_payment_term_name FROM payment_terms WHERE id = NEW.payment_terms_id;
                END IF;

                -- Fetch Payment Mode Name
                IF NEW.payment_mode_id IS NOT NULL THEN
                    SELECT name INTO v_payment_mode_name FROM payment_modes WHERE id = NEW.payment_mode_id;
                END IF;

                -- Check if Sales Order has explicit installments defined
                SELECT EXISTS(SELECT 1 FROM sales_document_payments WHERE document_id = NEW.id) INTO v_has_sales_installments;

                IF v_has_sales_installments THEN
                    -- Copy from Sales Document Payments with IDEMPOTENT upsert
                    INSERT INTO financial_event_installments (
                        event_id,
                        installment_number,
                        due_date,
                        amount,
                        payment_condition,
                        payment_method
                    )
                    SELECT 
                        (SELECT id FROM financial_events WHERE origin_type = 'SALE' AND origin_id = NEW.id LIMIT 1),
                        installment_number,
                        due_date,
                        amount,
                        COALESCE(v_payment_term_name, 'Personalizado'),
                        v_payment_mode_name
                    FROM sales_document_payments
                    WHERE document_id = NEW.id
                    ON CONFLICT (event_id, installment_number) 
                    DO UPDATE SET 
                        amount = EXCLUDED.amount,
                        due_date = EXCLUDED.due_date,
                        payment_condition = EXCLUDED.payment_condition,
                        payment_method = EXCLUDED.payment_method,
                        updated_at = NOW();
                ELSE
                    -- Default fallback: 1 installment, 30 days with IDEMPOTENT upsert
                    INSERT INTO financial_event_installments (
                        event_id,
                        installment_number,
                        due_date,
                        amount,
                        payment_condition,
                        payment_method
                    )
                    SELECT 
                        id,
                        1,
                        COALESCE(NEW.date_issued, CURRENT_DATE) + INTERVAL '30 days',
                        COALESCE(NEW.total_amount, 0),
                        COALESCE(v_payment_term_name, '30 dias'),
                        v_payment_mode_name
                    FROM financial_events
                    WHERE origin_type = 'SALE' AND origin_id = NEW.id
                    ON CONFLICT (event_id, installment_number) 
                    DO UPDATE SET 
                        amount = EXCLUDED.amount,
                        due_date = EXCLUDED.due_date,
                        payment_condition = EXCLUDED.payment_condition,
                        payment_method = EXCLUDED.payment_method,
                        updated_at = NOW();
                END IF;
             END;
        END IF;

    -- TRIGGER 2: SYNC OPERATIONAL STATUS & TOTAL
    -- If Event exists, update it
    ELSIF (NEW.status_logistic IS DISTINCT FROM OLD.status_logistic) OR (NEW.total_amount IS DISTINCT FROM OLD.total_amount) THEN
        
        UPDATE financial_events
        SET 
            operational_status = v_op_status,
            total_amount = NEW.total_amount,
            updated_at = NOW()
        WHERE origin_type = 'SALE' 
          AND origin_id = NEW.id
          AND status NOT IN ('approved', 'rejected');
          
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION handle_sales_event_trigger() IS 
'Manages financial event lifecycle for sales orders with smart reset logic for rejected events';

-- ========================================================================
-- VERIFICATION QUERIES (Run these after migration to validate)
-- ========================================================================

-- Check triggers are in place
-- SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE '%prevent_financial%';

-- Check unique constraint exists
-- SELECT conname, conrelid::regclass FROM pg_constraint WHERE conname = 'unique_event_installment_number';

-- Test data integrity
-- SELECT COUNT(*) as total_events, COUNT(DISTINCT (company_id, origin_type, origin_id)) as unique_origins 
-- FROM financial_events;
-- (total_events should equal unique_origins)
