-- ========================================================================
-- Fix Installment Calculation Using Structured Payment Terms
-- ========================================================================
-- Problem: handle_sales_event_trigger parses payment_term NAME as string
--          instead of using structured fields from payment_terms table
--
-- Solution: Replace string parsing with query to structured fields:
--           - installments_count
--           - first_due_days
--           - cadence_days
--
-- Based on validated logic from:
--   - 20260201093000_standardize_status_en.sql (lines 204-211)
--   - 20252001070000_ar_module.sql (lines 131-133)
-- ========================================================================

CREATE OR REPLACE FUNCTION public.handle_sales_event_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_partner_name TEXT;
    v_op_status TEXT;
    v_payment_term_name TEXT;
    v_payment_mode_name TEXT;
    v_has_sales_installments BOOLEAN;
    v_confirmation_date DATE;
    
    -- Structured payment terms fields
    v_terms RECORD;
    v_installments_count INT := 1;
    v_first_due_days INT := 0;
    v_cadence_days INT := 30;
    v_installment_value NUMERIC;
    v_remainder NUMERIC;
    v_current_due_date DATE;
    v_idx INT;
BEGIN
    -- Determine Operational Status
    -- FIX: Explicitly cast to TEXT to avoid Enum type mismatch (from 20260131180000_fix_enum_casts.sql)
    v_op_status := CASE 
        WHEN NEW.status_commercial = 'confirmed' THEN NEW.status_logistic::text 
        ELSE NEW.status_commercial::text 
    END;

    -- TRIGGER 1: CREATE EVENT ON CONFIRMATION
    IF NEW.status_commercial = 'confirmed' AND (OLD.status_commercial IS DISTINCT FROM 'confirmed') THEN
        
        -- Get partner name
        SELECT trade_name INTO v_partner_name 
        FROM organizations 
        WHERE id = NEW.client_id;
        
        -- Use confirmation date (NOW) as base for installment calculation
        v_confirmation_date := CURRENT_DATE;
        
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
            COALESCE(NEW.date_issued, v_confirmation_date),
            COALESCE(NEW.total_amount, 0),
            'pending',
            v_op_status
        )
        ON CONFLICT (company_id, origin_type, origin_id) 
        DO UPDATE SET 
            total_amount = EXCLUDED.total_amount,
            operational_status = EXCLUDED.operational_status,
            updated_at = NOW(),
            
            -- SMART STATUS RESET
            status = CASE
                WHEN financial_events.status = 'rejected' THEN 'pending'
                WHEN financial_events.status = 'approved' THEN 'approved'
                ELSE financial_events.status
            END,
            
            -- Clear rejection fields
            rejected_by = CASE WHEN financial_events.status = 'rejected' THEN NULL ELSE financial_events.rejected_by END,
            rejected_at = CASE WHEN financial_events.status = 'rejected' THEN NULL ELSE financial_events.rejected_at END,
            rejection_reason = CASE WHEN financial_events.status = 'rejected' THEN NULL ELSE financial_events.rejection_reason END,
            attention_marked_by = CASE WHEN financial_events.status = 'rejected' THEN NULL ELSE financial_events.attention_marked_by END,
            attention_marked_at = CASE WHEN financial_events.status = 'rejected' THEN NULL ELSE financial_events.attention_marked_at END,
            attention_reason = CASE WHEN financial_events.status = 'rejected' THEN NULL ELSE financial_events.attention_reason END;
        
        -- Fetch payment info using STRUCTURED FIELDS
        IF NEW.payment_terms_id IS NOT NULL THEN
            SELECT * INTO v_terms FROM payment_terms WHERE id = NEW.payment_terms_id;
            IF FOUND THEN
                v_installments_count := COALESCE(v_terms.installments_count, 1);
                v_first_due_days := COALESCE(v_terms.first_due_days, 0);
                v_cadence_days := COALESCE(v_terms.cadence_days, 30);
                v_payment_term_name := v_terms.name;
            END IF;
        END IF;
        
        IF NEW.payment_mode_id IS NOT NULL THEN
            SELECT name INTO v_payment_mode_name FROM payment_modes WHERE id = NEW.payment_mode_id;
        END IF;
        
        -- Check if order has explicit installments
        SELECT EXISTS(SELECT 1 FROM sales_document_payments WHERE document_id = NEW.id) INTO v_has_sales_installments;

        -- Only create installments if they don't exist yet
        IF NOT EXISTS (
            SELECT 1 FROM financial_event_installments fei
            JOIN financial_events fe ON fe.id = fei.event_id
            WHERE fe.origin_type = 'SALE' AND fe.origin_id = NEW.id
        ) THEN
            IF v_has_sales_installments THEN
                -- Copy from explicit installments
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
                ORDER BY installment_number
                ON CONFLICT (event_id, installment_number) 
                DO UPDATE SET 
                    amount = EXCLUDED.amount,
                    due_date = EXCLUDED.due_date,
                    payment_condition = EXCLUDED.payment_condition,
                    payment_method = EXCLUDED.payment_method,
                    updated_at = NOW();
            ELSE
                -- Calculate installments from STRUCTURED payment_terms fields
                -- This replaces the old string parsing logic
                
                -- Calculate amount per installment
                v_installment_value := TRUNC(COALESCE(NEW.total_amount, 0) / v_installments_count, 2);
                v_remainder := COALESCE(NEW.total_amount, 0) - (v_installment_value * v_installments_count);
                
                -- First due date: confirmation_date + first_due_days
                v_current_due_date := v_confirmation_date + v_first_due_days;
                
                -- Insert installments
                FOR v_idx IN 1..v_installments_count LOOP
                    INSERT INTO financial_event_installments (
                        event_id,
                        installment_number,
                        due_date,
                        amount,
                        payment_condition,
                        payment_method
                    )
                    VALUES (
                        (SELECT id FROM financial_events WHERE origin_type = 'SALE' AND origin_id = NEW.id LIMIT 1),
                        v_idx,
                        v_current_due_date,
                        CASE 
                            -- Last installment gets the remainder to avoid rounding errors
                            WHEN v_idx = v_installments_count 
                            THEN v_installment_value + v_remainder
                            ELSE v_installment_value
                        END,
                        COALESCE(v_payment_term_name, v_installments_count || 'x'),
                        v_payment_mode_name
                    )
                    ON CONFLICT (event_id, installment_number) 
                    DO UPDATE SET 
                        amount = EXCLUDED.amount,
                        due_date = EXCLUDED.due_date,
                        payment_condition = EXCLUDED.payment_condition,
                        payment_method = EXCLUDED.payment_method,
                        updated_at = NOW();
                    
                    -- Next due date: add cadence_days
                    IF v_cadence_days > 0 THEN
                        v_current_due_date := v_current_due_date + v_cadence_days;
                    END IF;
                END LOOP;
            END IF;
        END IF;

    -- TRIGGER 2: SYNC OPERATIONAL STATUS & TOTAL
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
'Manages financial event lifecycle using STRUCTURED payment terms fields (installments_count, first_due_days, cadence_days) instead of parsing name strings';

-- Ensure trigger is attached (should already exist from previous migration)
DROP TRIGGER IF EXISTS on_sales_confirmation_create_event ON public.sales_documents;
CREATE TRIGGER on_sales_confirmation_create_event
    AFTER INSERT OR UPDATE ON public.sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sales_event_trigger();
