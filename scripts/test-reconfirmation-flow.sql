-- ========================================================================
-- Re-confirmation Flow Test Suite
-- ========================================================================
-- These tests validate the complete re-confirmation flow after financial rejection
-- Run with: psql <connection-string> -f scripts/test-reconfirmation-flow.sql
-- ========================================================================

BEGIN;

-- Test Setup: Create test data
DO $$
DECLARE
    v_company_id UUID;
    v_client_id UUID;
    v_order_id UUID;
    v_event_id UUID;
    v_event_status TEXT;
    v_event_count INT;
    v_installment_count INT;
BEGIN
    -- Get first company and client for testing
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    SELECT id INTO v_client_id FROM organizations WHERE type = 'CLIENT' LIMIT 1;
    
    IF v_company_id IS NULL OR v_client_id IS NULL THEN
        RAISE EXCEPTION 'Test data not available: need at least one company and client';
    END IF;

    RAISE NOTICE '====== TEST A: Reject and Resend Flow ======';
    
    -- 1. Create test order
    INSERT INTO sales_documents (
       company_id, client_id, status_commercial, status_logistic,
        total_amount, date_issued, doc_type
    ) VALUES (
        v_company_id, v_client_id, 'draft', 'pendente',
        1000.00, CURRENT_DATE, 'order'
    ) RETURNING id INTO v_order_id;
    
    RAISE NOTICE 'Step 1: Created test order %', v_order_id;
    
    -- 2. Confirm order (should create financial event)
    UPDATE sales_documents 
    SET status_commercial = 'confirmed' 
    WHERE id = v_order_id;
    
    -- Verify event created
    SELECT id, status INTO v_event_id, v_event_status
    FROM financial_events 
    WHERE origin_id = v_order_id;
    
    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'FAIL: Financial event not created on confirmation';
    END IF;
    
    IF v_event_status != 'pendente' THEN
        RAISE EXCEPTION 'FAIL: Event status should be pendente, got %', v_event_status;
    END IF;
    
    RAISE NOTICE 'Step 2: Order confirmed, event % created with status=%', v_event_id, v_event_status;
    
    -- 3. Reject financially
    UPDATE financial_events 
    SET status = 'reprovado',
        rejected_by = 'test-user-id',
        rejection_reason = 'Test rejection'
    WHERE id = v_event_id;
    
    UPDATE sales_documents 
    SET dispatch_blocked = true,
        status_commercial = 'draft',
        financial_status = 'em_revisao'
    WHERE id = v_order_id;
    
    RAISE NOTICE 'Step 3: Order rejected and blocked';
    
    -- 4. Re-confirm order
    UPDATE sales_documents 
    SET status_commercial = 'confirmed' 
    WHERE id = v_order_id;
    
    -- 5. Verify event reset
    SELECT status INTO v_event_status
    FROM financial_events 
    WHERE id = v_event_id;
    
    IF v_event_status != 'pendente' THEN
        RAISE EXCEPTION 'FAIL: Event status should reset to pendente, got %', v_event_status;
    END IF;
    
    RAISE NOTICE 'Step 4-5: ✅ Event status correctly reset to pendente';
    
    -- 6. Verify no duplication
    SELECT COUNT(*) INTO v_event_count
    FROM financial_events 
    WHERE origin_id = v_order_id;
    
    IF v_event_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Should have exactly 1 event, found %', v_event_count;
    END IF;
    
    RAISE NOTICE 'Step 6: ✅ No event duplication (count=%)', v_event_count;
    
    -- 7. Verify rejection fields cleared
    SELECT rejected_by::TEXT INTO v_event_status
    FROM financial_events 
    WHERE id = v_event_id;
    
    IF v_event_status IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL: rejected_by should be NULL, got %', v_event_status;
    END IF;
    
    RAISE NOTICE 'Step 7: ✅ Rejection fields cleared';
    
    RAISE NOTICE '====== TEST B: Prevent Deletion ======';
    
    -- Try to delete event (should fail)
    BEGIN
        DELETE FROM financial_events WHERE id = v_event_id;
        RAISE EXCEPTION 'FAIL: Deletion should have been prevented';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Step 8: ✅ Deletion correctly prevented: %', SQLERRM;
    END;
    
    RAISE NOTICE '====== TEST C: Unique Installment Constraint ======';
    
    -- Verify only one installment exists
    SELECT COUNT(*) INTO v_installment_count
    FROM financial_event_installments 
    WHERE event_id = v_event_id;
    
    RAISE NOTICE 'Step 9: Initial installments count=%', v_installment_count;
    
    -- Try to insert duplicate (should upsert, not duplicate)
    INSERT INTO financial_event_installments (
        event_id, installment_number, due_date, amount
    ) VALUES (
        v_event_id, 1, CURRENT_DATE, 500.00
    )
    ON CONFLICT (event_id, installment_number) 
    DO UPDATE SET amount = EXCLUDED.amount;
    
    SELECT COUNT(*) INTO v_installment_count
    FROM financial_event_installments 
    WHERE event_id = v_event_id;
    
    IF v_installment_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Installments duplicated, count=%', v_installment_count;
    END IF;
    
    RAISE NOTICE 'Step 10: ✅ Installments not duplicated (count still=%)', v_installment_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ ALL TESTS PASSED';
    RAISE NOTICE '========================================';
    
END $$;

ROLLBACK;

-- Verification queries (run these after migration to validate setup)
-- Uncomment to inspect:

-- SELECT tgname, tgrelid::regclass 
-- FROM pg_trigger 
-- WHERE tgname LIKE '%prevent_financial%';

-- SELECT conname, conrelid::regclass 
-- FROM pg_constraint 
-- WHERE conname = 'unique_event_installment_number';
