-- Standardize financial_events.status to EN

BEGIN;

-- 0) Drop partial index that compares status to PT literals
DROP INDEX IF EXISTS public.idx_financial_events_status;

-- Drop legacy CHECK constraint on status (enum will enforce values)
ALTER TABLE public.financial_events
    DROP CONSTRAINT IF EXISTS financial_events_status_check;

-- Drop any existing partial indexes on financial_events that filter by status
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'financial_events'
          AND indexdef ILIKE '%where%'
          AND indexdef ILIKE '%status%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schemaname, r.indexname);
    END LOOP;
END $$;

-- 1) Create EN enum for financial_events status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_event_status_en') THEN
        CREATE TYPE public.financial_event_status_en AS ENUM (
            'pending', 'attention', 'approving', 'approved', 'rejected'
        );
    END IF;
END $$;

-- 2) Convert column to EN enum
ALTER TABLE public.financial_events
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.financial_events
    ALTER COLUMN status TYPE text
    USING status::text;

ALTER TABLE public.financial_events
    ALTER COLUMN status TYPE public.financial_event_status_en
    USING (
        CASE (status::text)
            WHEN 'pending' THEN 'pending'
            WHEN 'attention' THEN 'attention'
            WHEN 'approving' THEN 'approving'
            WHEN 'approved' THEN 'approved'
            WHEN 'rejected' THEN 'rejected'
            WHEN 'pending' THEN 'pending'
            WHEN 'attention' THEN 'attention'
            WHEN 'approving' THEN 'approving'
            WHEN 'approved' THEN 'approved'
            WHEN 'rejected' THEN 'rejected'
            ELSE 'pending'
        END
    )::public.financial_event_status_en;

ALTER TABLE public.financial_events
    ALTER COLUMN status SET DEFAULT 'pending';

-- 3) Update trigger functions to EN status values
CREATE OR REPLACE FUNCTION public.handle_sales_event_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_partner_name TEXT;
    v_op_status TEXT;
BEGIN
    -- Determine Operational Status (use Logistic Status if Commercial is Confirmed, else Commercial)
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
            total_amount = EXCLUDED.total_amount,
            operational_status = EXCLUDED.operational_status,
            updated_at = NOW(),
            
            -- SMART STATUS RESET: Reset rejected events to pending, preserve approved
            status = CASE
                WHEN financial_events.status = 'rejected' THEN 'pending'
                WHEN financial_events.status = 'approved' THEN 'approved'
                ELSE financial_events.status
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
                SELECT id INTO v_default_account FROM gl_accounts WHERE company_id = NEW.company_id AND code = '3.01.01' LIMIT 1;
                SELECT id INTO v_default_cc FROM cost_centers WHERE company_id = NEW.company_id AND code = '001' LIMIT 1;
                
                IF NEW.payment_terms_id IS NOT NULL THEN
                    SELECT name INTO v_payment_term_name FROM payment_terms WHERE id = NEW.payment_terms_id;
                END IF;

                IF NEW.payment_mode_id IS NOT NULL THEN
                    SELECT name INTO v_payment_mode_name FROM payment_modes WHERE id = NEW.payment_mode_id;
                END IF;

                SELECT EXISTS(SELECT 1 FROM sales_document_payments WHERE document_id = NEW.id) INTO v_has_sales_installments;

                IF v_has_sales_installments THEN
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

CREATE OR REPLACE FUNCTION public.handle_purchase_event_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_partner_name TEXT;
    v_def_account UUID;
    v_def_cc UUID;
BEGIN
    -- TRIGGER 1: CREATE EVENT ON SENT
    IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN
        
        SELECT trade_name, default_account_id, default_cost_center_id 
        INTO v_partner_name, v_def_account, v_def_cc
        FROM organizations 
        WHERE id = NEW.supplier_id;
        
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
            'PURCHASE',
            NEW.id,
            'Pedido de Compra', 
            NEW.supplier_id,
            COALESCE(v_partner_name, 'Fornecedor não identificado'),
            'AP',
            COALESCE(NEW.ordered_at::DATE, CURRENT_DATE),
            0, 
            'pending',
            NEW.status
        )
        ON CONFLICT (company_id, origin_type, origin_id) 
        DO UPDATE SET 
            operational_status = EXCLUDED.operational_status,
            updated_at = NOW()
        WHERE financial_events.status NOT IN ('approved', 'rejected');
        
        IF NOT EXISTS (
            SELECT 1 FROM financial_event_installments fei
            JOIN financial_events fe ON fe.id = fei.event_id
            WHERE fe.origin_type = 'PURCHASE' AND fe.origin_id = NEW.id
        ) THEN
             INSERT INTO financial_event_installments (
                event_id,
                installment_number,
                due_date,
                amount,
                payment_condition,
                suggested_account_id,
                cost_center_id
            )
            SELECT 
                id,
                1,
                CURRENT_DATE + INTERVAL '30 days',
                0,
                'A definir',
                v_def_account,
                v_def_cc
            FROM financial_events
            WHERE origin_type = 'PURCHASE' AND origin_id = NEW.id;
        END IF;

    -- TRIGGER 2: SYNC OPERATIONAL STATUS
    ELSIF (NEW.status IS DISTINCT FROM OLD.status) THEN
        
        UPDATE financial_events
        SET 
            operational_status = NEW.status,
            updated_at = NOW()
        WHERE origin_type = 'PURCHASE' 
          AND origin_id = NEW.id
          AND status NOT IN ('approved', 'rejected');
          
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Recreate partial index with EN values
CREATE INDEX IF NOT EXISTS idx_financial_events_status 
  ON financial_events(status) 
  WHERE status IN ('pending', 'attention');

COMMIT;
