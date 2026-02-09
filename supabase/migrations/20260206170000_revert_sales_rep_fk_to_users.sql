-- ========================================================================
-- REVERT + FIX: Sales Rep FK Should Point to Users, Not Organizations
-- ========================================================================
-- Business Rule Clarification:
--   - sales_rep_id = pessoa vendedora (usuário do sistema)
--   - FK deve apontar para public.users.id (ou auth.users.id)
--   - Se futuramente precisar "representante como empresa", criar outro campo
--
-- This migration:
--   1. Reverts the incorrect FK to organizations
--   2. Creates correct FK to public.users
--   3. Keeps the trigger fix with ::text casts
-- ========================================================================

BEGIN;

-- ========================================================================
-- PART 1: Fix sales_rep_id Foreign Key (REVERT to users)
-- ========================================================================

-- Step 1: Drop the incorrect FK to organizations
ALTER TABLE public.sales_documents
    DROP CONSTRAINT IF EXISTS sales_documents_sales_rep_id_fkey;

-- Step 2: Make column nullable (keep this from previous migration)
ALTER TABLE public.sales_documents
    ALTER COLUMN sales_rep_id DROP NOT NULL;

-- Step 3: Clean invalid data (IDs that don't exist in public.users)
UPDATE public.sales_documents
SET sales_rep_id = NULL
WHERE sales_rep_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = sales_documents.sales_rep_id
  );

-- Step 4: Create CORRECT FK constraint pointing to public.users
ALTER TABLE public.sales_documents
    ADD CONSTRAINT sales_documents_sales_rep_id_fkey
    FOREIGN KEY (sales_rep_id)
    REFERENCES public.users(id)
    ON DELETE SET NULL;

COMMENT ON CONSTRAINT sales_documents_sales_rep_id_fkey ON public.sales_documents IS
'References public.users table. Represents the salesperson (system user) who created/owns this sales document.';

-- ========================================================================
-- PART 2: Revert organizations.sales_rep_user_id FK (if it was changed)
-- ========================================================================

-- This field might have been incorrectly modified - revert if needed
ALTER TABLE public.organizations
    DROP CONSTRAINT IF EXISTS organizations_sales_rep_user_id_fkey;

-- If this field should reference users, recreate it
-- (Commenting out - need to verify business rule for this field)
-- ALTER TABLE public.organizations
--     ADD CONSTRAINT organizations_sales_rep_user_id_fkey
--     FOREIGN KEY (sales_rep_user_id)
--     REFERENCES public.users(id)
--     ON DELETE SET NULL;

-- ========================================================================
-- PART 3: Keep Trigger Fix with ::text Casts
-- ========================================================================
-- This part is correct and should be kept from the previous migration

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
    -- CRITICAL: Cast to TEXT to avoid Enum type mismatch
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
        
        -- Use confirmation date as base
        v_confirmation_date := CURRENT_DATE;
        
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
            status = CASE
                WHEN financial_events.status = 'rejected' THEN 'pending'
                WHEN financial_events.status = 'approved' THEN 'approved'
                ELSE financial_events.status
            END,
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
        
        -- Check for explicit installments
        SELECT EXISTS(SELECT 1 FROM sales_document_payments WHERE document_id = NEW.id) INTO v_has_sales_installments;

        -- Only create installments if they don't exist
        IF NOT EXISTS (
            SELECT 1 FROM financial_event_installments fei
            JOIN financial_events fe ON fe.id = fei.event_id
            WHERE fe.origin_type = 'SALE' AND fe.origin_id = NEW.id
        ) THEN
            IF v_has_sales_installments THEN
                -- Copy from explicit installments
                INSERT INTO financial_event_installments (
                    event_id, installment_number, due_date, amount, payment_condition, payment_method
                )
                SELECT 
                    (SELECT id FROM financial_events WHERE origin_type = 'SALE' AND origin_id = NEW.id LIMIT 1),
                    installment_number, due_date, amount,
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
                -- Calculate from structured payment_terms
                v_installment_value := TRUNC(COALESCE(NEW.total_amount, 0) / v_installments_count, 2);
                v_remainder := COALESCE(NEW.total_amount, 0) - (v_installment_value * v_installments_count);
                v_current_due_date := v_confirmation_date + v_first_due_days;
                
                FOR v_idx IN 1..v_installments_count LOOP
                    INSERT INTO financial_event_installments (
                        event_id, installment_number, due_date, amount, payment_condition, payment_method
                    )
                    VALUES (
                        (SELECT id FROM financial_events WHERE origin_type = 'SALE' AND origin_id = NEW.id LIMIT 1),
                        v_idx,
                        v_current_due_date,
                        CASE WHEN v_idx = v_installments_count THEN v_installment_value + v_remainder ELSE v_installment_value END,
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
'Manages financial events with structured payment terms and proper type casts. Fixed in migration 20260206170000.';

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_sales_confirmation_create_event ON public.sales_documents;
CREATE TRIGGER on_sales_confirmation_create_event
    AFTER INSERT OR UPDATE ON public.sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sales_event_trigger();

COMMIT;

-- ========================================================================
-- VERIFICATION QUERIES (run after migration)
-- ========================================================================
-- 1. Verify FK points to users:
--    SELECT constraint_name, table_name, 
--           pg_get_constraintdef(oid) as definition
--    FROM pg_constraint 
--    WHERE conname = 'sales_documents_sales_rep_id_fkey';
--
-- 2. Verify no orphaned data:
--    SELECT COUNT(*) FROM sales_documents 
--    WHERE sales_rep_id IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM users WHERE id = sales_documents.sales_rep_id);
-- ========================================================================
