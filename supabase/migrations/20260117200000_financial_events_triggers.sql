-- ========================================================================
-- Financial Events Triggers & Operational Status
-- ========================================================================
-- 1. Add operational_status column
-- 2. Implement Trigger for Sales (Commercial Confirmation)
-- 3. Implement Trigger for Purchases (Sent to Supplier)
-- 4. Sync Operational Status changes
-- ========================================================================

-- 1. Add operational_status column
ALTER TABLE financial_events 
ADD COLUMN IF NOT EXISTS operational_status TEXT;

COMMENT ON COLUMN financial_events.operational_status IS 'Current status of the origin document (e.g. Sales Logistic Status or PO Status)';

-- 2. Function to Handle Sales Events (Create & Sync)
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
        
        -- Create/Upsert Financial Event
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
            updated_at = NOW()
        WHERE financial_events.status NOT IN ('approved', 'rejected'); -- Only update if not finalized
        
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
                    -- Copy from Sales Document Payments
                    INSERT INTO financial_event_installments (
                        event_id,
                        installment_number,
                        due_date,
                        amount,
                        payment_condition,
                        payment_method,
                        account_id,
                        cost_center_id
                    )
                    SELECT 
                        (SELECT id FROM financial_events WHERE origin_type = 'SALE' AND origin_id = NEW.id LIMIT 1),
                        installment_number,
                        due_date,
                        amount,
                        COALESCE(v_payment_term_name, 'Personalizado'),
                        v_payment_mode_name,
                        v_default_account,
                        v_default_cc
                    FROM sales_document_payments
                    WHERE document_id = NEW.id;
                ELSE
                    -- Default fallback: 1 installment, 30 days (or term name)
                    INSERT INTO financial_event_installments (
                        event_id,
                        installment_number,
                        due_date,
                        amount,
                        payment_condition,
                        payment_method,
                        account_id,
                        cost_center_id
                    )
                    SELECT 
                        id,
                        1,
                        COALESCE(NEW.date_issued, CURRENT_DATE) + INTERVAL '30 days', -- Improvement: Parse term days if possible, or leave 30 as fallback
                        COALESCE(NEW.total_amount, 0),
                        COALESCE(v_payment_term_name, '30 dias'),
                        v_payment_mode_name,
                        v_default_account,
                        v_default_cc
                    FROM financial_events
                    WHERE origin_type = 'SALE' AND origin_id = NEW.id;
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

-- 3. Function to Handle Purchase Events (Create & Sync)
CREATE OR REPLACE FUNCTION public.handle_purchase_event_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_partner_name TEXT;
    v_def_account UUID;
    v_def_cc UUID;
BEGIN
    -- TRIGGER 1: CREATE EVENT ON SENT
    -- If status becomes 'sent' (and wasn't before)
    IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN
        
        -- Get partner name and defaults
        SELECT trade_name, default_account_id, default_cost_center_id 
        INTO v_partner_name, v_def_account, v_def_cc
        FROM organizations 
        WHERE id = NEW.supplier_id;
        
        -- Create/Upsert Financial Event
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
            -- Purchase Order Number? Assuming we might not have a clean number yet or use ID
            'Pedido de Compra', 
            NEW.supplier_id,
            COALESCE(v_partner_name, 'Fornecedor não identificado'),
            'AP',
            COALESCE(NEW.ordered_at::DATE, CURRENT_DATE),
            -- Does PO have total_amount? The table definition doesn't show a total_amount column on header!
            -- We might need to sum items or assume it's calculated.
            -- Based on previous view, purchase_orders doesn't have total_amount.
            -- We'll assume 0 for now or fetch from items sum if possible.
            0, 
            'pending',
            NEW.status
        )
        ON CONFLICT (company_id, origin_type, origin_id) 
        DO UPDATE SET 
            operational_status = EXCLUDED.operational_status,
            updated_at = NOW()
        WHERE financial_events.status NOT IN ('approved', 'rejected');
        
        -- Initial Installment (Placeholder)
        -- Real implementation would try to sum items or use payment terms if available.
        -- Implementation note: Purchase Orders table in schema provided doesn't have total_amount.
        -- We will leave amount as 0 to force user to edit/validate.
       
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
                account_id,
                cost_center_id
            )
            SELECT 
                id,
                1,
                CURRENT_DATE + INTERVAL '30 days',
                0, -- Requires attention
                'A definir',
                v_def_account, -- From Supplier or NULL
                v_def_cc      -- From Supplier or NULL
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

-- 4. Apply Triggers

-- Remove old triggers if they exist
DROP TRIGGER IF EXISTS trg_sales_event_sync ON sales_documents;
DROP TRIGGER IF EXISTS on_sales_logistic_update ON sales_documents; -- The one we made previously

-- Create new Sales Trigger
CREATE TRIGGER trg_sales_event_sync
    AFTER UPDATE ON sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION handle_sales_event_trigger();

-- Create Purchase Trigger
DROP TRIGGER IF EXISTS trg_purchase_event_sync ON purchase_orders;
CREATE TRIGGER trg_purchase_event_sync
    AFTER UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_purchase_event_trigger();
    
-- ========================================================================
-- BACKFILL
-- ========================================================================
-- Update existing events with current operational status from Sales
UPDATE financial_events fe
SET operational_status = 
    CASE 
        WHEN sd.status_commercial = 'confirmed' THEN sd.status_logistic::text
        ELSE sd.status_commercial::text
    END
FROM sales_documents sd
WHERE fe.origin_type = 'SALE' AND fe.origin_id = sd.id;

-- Update existing events with current operational status from Purchases
UPDATE financial_events fe
SET operational_status = po.status
FROM purchase_orders po
WHERE fe.origin_type = 'PURCHASE' AND fe.origin_id = po.id;
