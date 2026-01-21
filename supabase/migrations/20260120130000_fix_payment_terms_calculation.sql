-- ========================================================================
-- Fix Payment Terms Calculation in Financial Events
-- ========================================================================
-- Problem: When sales order doesn't have explicit installments in 
--          sales_document_payments, the system uses a hardcoded 30-day fallback
--          instead of using the actual payment terms from the order
--
-- Solution: Calculate installments based on:
--   1. payment_terms_id from order (e.g., "2x - 21-28" = 2 installments at 21 and 28 days)
--   2. payment_mode_id from order
--   3. Confirmation date (updated_at when status_commercial becomes 'confirmed')
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
BEGIN
    -- Determine Operational Status
    v_op_status := CASE 
        WHEN NEW.status_commercial = 'confirmed' THEN NEW.status_logistic 
        ELSE NEW.status_commercial 
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
            'pendente',
            v_op_status
        )
        ON CONFLICT (company_id, origin_type, origin_id) 
        DO UPDATE SET 
            total_amount = EXCLUDED.total_amount,
            operational_status = EXCLUDED.operational_status,
            updated_at = NOW(),
            
            -- SMART STATUS RESET
            status = CASE
                WHEN financial_events.status = 'reprovado' THEN 'pendente'
                WHEN financial_events.status = 'aprovado' THEN 'aprovado'
                ELSE financial_events.status
            END,
            
            -- Clear rejection fields
            rejected_by = CASE WHEN financial_events.status = 'reprovado' THEN NULL ELSE financial_events.rejected_by END,
            rejected_at = CASE WHEN financial_events.status = 'reprovado' THEN NULL ELSE financial_events.rejected_at END,
            rejection_reason = CASE WHEN financial_events.status = 'reprovado' THEN NULL ELSE financial_events.rejection_reason END,
            attention_marked_by = CASE WHEN financial_events.status = 'reprovado' THEN NULL ELSE financial_events.attention_marked_by END,
            attention_marked_at = CASE WHEN financial_events.status = 'reprovado' THEN NULL ELSE financial_events.attention_marked_at END,
            attention_reason = CASE WHEN financial_events.status = 'reprovado' THEN NULL ELSE financial_events.attention_reason END;
        
        -- Fetch payment info
        IF NEW.payment_terms_id IS NOT NULL THEN
            SELECT name INTO v_payment_term_name FROM payment_terms WHERE id = NEW.payment_terms_id;
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
                -- Calculate installments from payment_terms_id
                -- Parse "2x - 21-28" format from payment terms name
                DECLARE
                    v_term_parts TEXT[];
                    v_installment_count INT;
                    v_days_part TEXT;
                    v_day_intervals INT[];
                    v_day TEXT;
                    v_idx INT;
                    v_installment_amount NUMERIC(15,2);
                BEGIN
                    -- Default: 1 installment, 30 days
                    v_installment_count := 1;
                    v_day_intervals := ARRAY[30];
                    
                    -- Try to parse payment terms name if available
                    IF v_payment_term_name IS NOT NULL AND v_payment_term_name ~ '^\d+x' THEN
                        -- Split by " - " to get parts: ["2x", "21-28"]
                        v_term_parts := string_to_array(v_payment_term_name, ' - ');
                        
                        -- Extract installment count from "2x" → 2
                        v_installment_count := substring(v_term_parts[1] from '^\d+')::INT;
                        
                        -- Extract day intervals if second part exists
                        IF array_length(v_term_parts, 1) >= 2 THEN
                            v_days_part := v_term_parts[2];
                            v_day_intervals := ARRAY[]::INT[];
                            
                            -- Split "21-28" or "21-28-35" into array
                            FOREACH v_day IN ARRAY string_to_array(v_days_part, '-')
                            LOOP
                                v_day_intervals := array_append(v_day_intervals, v_day::INT);
                            END LOOP;
                        ELSE
                            -- No days specified, use even distribution (30, 60, 90, ...)
                            v_day_intervals := ARRAY[]::INT[];
                            FOR v_idx IN 1..v_installment_count LOOP
                                v_day_intervals := array_append(v_day_intervals, v_idx * 30);
                            END LOOP;
                        END IF;
                    END IF;
                    
                    -- Calculate amount per installment
                    v_installment_amount := ROUND(COALESCE(NEW.total_amount, 0) / v_installment_count, 2);
                    
                    -- Insert installments
                    FOR v_idx IN 1..v_installment_count LOOP
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
                            v_confirmation_date + (v_day_intervals[LEAST(v_idx, array_length(v_day_intervals, 1))] || ' days')::INTERVAL,
                            CASE 
                                -- Last installment gets the remainder to avoid rounding errors
                                WHEN v_idx = v_installment_count 
                                THEN COALESCE(NEW.total_amount, 0) - (v_installment_amount * (v_installment_count - 1))
                                ELSE v_installment_amount
                            END,
                            COALESCE(v_payment_term_name, v_installment_count || 'x'),
                            v_payment_mode_name
                        )
                        ON CONFLICT (event_id, installment_number) 
                        DO UPDATE SET 
                            amount = EXCLUDED.amount,
                            due_date = EXCLUDED.due_date,
                            payment_condition = EXCLUDED.payment_condition,
                            payment_method = EXCLUDED.payment_method,
                            updated_at = NOW();
                    END LOOP;
                END;
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
          AND status NOT IN ('aprovado', 'reprovado');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION handle_sales_event_trigger() IS 
'Manages financial event lifecycle with smart payment terms parsing from order';
