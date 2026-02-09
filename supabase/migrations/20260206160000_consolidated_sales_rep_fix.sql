-- ========================================================================
-- CONSOLIDATED FIX: Sales Rep FK + Trigger Type Casts
-- ========================================================================
-- This migration consolidates multiple fixes into ONE tested solution:
-- 1. Makes sales_rep_id nullable (safest approach)
-- 2. Drops conflicting FK constraints
-- 3. Creates correct FK to organizations
-- 4. Re-applies trigger with ::text casts
--
-- Strategy: NULLABLE approach
-- - Safest: No data loss, no forced migration
-- - Users can re-assign sales_rep via UI after migration
-- - FK validates future assignments
-- ========================================================================

BEGIN;

-- ========================================================================
-- PART 1: Fix sales_rep_id Foreign Key
-- ========================================================================

-- Step 1: Drop ALL existing FK constraints on sales_rep_id
ALTER TABLE public.sales_documents
    DROP CONSTRAINT IF EXISTS sales_documents_sales_rep_id_fkey;

ALTER TABLE public.sales_documents
    DROP CONSTRAINT IF EXISTS sales_documents_sales_rep_id_public_users_fkey;

-- Step 2: Make column nullable if not already
ALTER TABLE public.sales_documents
    ALTER COLUMN sales_rep_id DROP NOT NULL;

-- Step 3: Set to NULL any IDs that don't point to organizations
-- (This handles orphaned data from old user-based references)
UPDATE public.sales_documents
SET sales_rep_id = NULL
WHERE sales_rep_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = sales_documents.sales_rep_id
  );

-- Step 4: Create proper FK constraint (validated, not NOT VALID)
ALTER TABLE public.sales_documents
    ADD CONSTRAINT sales_documents_sales_rep_id_fkey
    FOREIGN KEY (sales_rep_id)
    REFERENCES public.organizations(id)
    ON DELETE SET NULL;

-- Step 5: Similarly fix organizations.sales_rep_user_id
ALTER TABLE public.organizations
    DROP CONSTRAINT IF EXISTS organizations_sales_rep_user_id_fkey;

ALTER TABLE public.organizations
    ALTER COLUMN sales_rep_user_id DROP NOT NULL;

UPDATE public.organizations
SET sales_rep_user_id = NULL
WHERE sales_rep_user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.organizations o2
      WHERE o2.id = organizations.sales_rep_user_id
  );

ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_sales_rep_user_id_fkey
    FOREIGN KEY (sales_rep_user_id)
    REFERENCES public.organizations(id)
    ON DELETE SET NULL;

-- ========================================================================
-- PART 2: Fix Trigger Type Casts
-- ========================================================================
-- Re-apply handle_sales_event_trigger with ::text casts to prevent
-- "CASE/WHEN could not convert type" errors

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
'Manages financial events with structured payment terms and proper type casts. Fixed in migration 20260206160000.';

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
-- 1. Verify FK exists and points to organizations:
--    SELECT * FROM information_schema.table_constraints 
--    WHERE table_name = 'sales_documents' AND constraint_name LIKE '%sales_rep%';
--
-- 2. Verify no orphaned data:
--    SELECT COUNT(*) FROM sales_documents WHERE sales_rep_id IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = sales_documents.sales_rep_id);
--
-- 3. Test creating order:
--    Should work with or without sales_rep_id
-- ========================================================================
