-- Migration: Diagnose Status Values Before Normalization (IMPROVED)
-- Purpose: Inspect current constraints and data to build safe migration strategy
-- DO NOT ALTER DATA - This is read-only diagnostics

BEGIN;

-- ========================================
-- STEP 1: Inspect Current CHECK Constraints
-- ========================================

DO $$
DECLARE
    v_constraint_name TEXT;
    v_constraint_def TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 1: Current CHECK Constraints';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- sales_documents.status_commercial (search by definition, not name)
    SELECT conname, pg_get_constraintdef(oid)
    INTO v_constraint_name, v_constraint_def
    FROM pg_constraint
    WHERE conrelid = 'public.sales_documents'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status_commercial%'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        RAISE NOTICE 'status_commercial:';
        RAISE NOTICE '  Name: %', v_constraint_name;
        RAISE NOTICE '  Definition: %', v_constraint_def;
    ELSE
        RAISE NOTICE 'status_commercial: NO CHECK CONSTRAINT FOUND';
    END IF;
    RAISE NOTICE '';

    -- sales_documents.status_logistic
    SELECT conname, pg_get_constraintdef(oid)
    INTO v_constraint_name, v_constraint_def
    FROM pg_constraint
    WHERE conrelid = 'public.sales_documents'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status_logistic%'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        RAISE NOTICE 'status_logistic:';
        RAISE NOTICE '  Name: %', v_constraint_name;
        RAISE NOTICE '  Definition: %', v_constraint_def;
    ELSE
        RAISE NOTICE 'status_logistic: NO CHECK CONSTRAINT FOUND';
    END IF;
    RAISE NOTICE '';

    -- sales_documents.status_fiscal
    SELECT conname, pg_get_constraintdef(oid)
    INTO v_constraint_name, v_constraint_def
    FROM pg_constraint
    WHERE conrelid = 'public.sales_documents'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status_fiscal%'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        RAISE NOTICE 'status_fiscal:';
        RAISE NOTICE '  Name: %', v_constraint_name;
        RAISE NOTICE '  Definition: %', v_constraint_def;
    ELSE
        RAISE NOTICE 'status_fiscal: NO CHECK CONSTRAINT FOUND';
    END IF;
    RAISE NOTICE '';

    -- sales_documents.financial_status
    SELECT conname, pg_get_constraintdef(oid)
    INTO v_constraint_name, v_constraint_def
    FROM pg_constraint
    WHERE conrelid = 'public.sales_documents'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%financial_status%'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        RAISE NOTICE 'financial_status:';
        RAISE NOTICE '  Name: %', v_constraint_name;
        RAISE NOTICE '  Definition: %', v_constraint_def;
    ELSE
        RAISE NOTICE 'financial_status: NO CHECK CONSTRAINT FOUND';
    END IF;
    RAISE NOTICE '';

    -- purchase_orders.status (search by definition for 'status')
    SELECT conname, pg_get_constraintdef(oid)
    INTO v_constraint_name, v_constraint_def
    FROM pg_constraint
    WHERE conrelid = 'public.purchase_orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%'
    AND pg_get_constraintdef(oid) NOT ILIKE '%updated%'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        RAISE NOTICE 'purchase_orders.status:';
        RAISE NOTICE '  Name: %', v_constraint_name;
        RAISE NOTICE '  Definition: %', v_constraint_def;
    ELSE
        RAISE NOTICE 'purchase_orders.status: NO CHECK CONSTRAINT FOUND';
    END IF;
END $$;

-- ========================================
-- STEP 2: Analyze Real Data Values
-- ========================================

DO $$
DECLARE
    v_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 2: Real Data Distribution';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- sales_documents.status_commercial
    RAISE NOTICE 'status_commercial distribution:';
    FOR v_record IN 
        SELECT status_commercial, COUNT(*) as count
        FROM public.sales_documents
        GROUP BY status_commercial
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  % : % records', RPAD(COALESCE(v_record.status_commercial, '(null)'), 20), v_record.count;
    END LOOP;
    RAISE NOTICE '';

    -- sales_documents.status_logistic
    RAISE NOTICE 'status_logistic distribution:';
    FOR v_record IN 
        SELECT status_logistic, COUNT(*) as count
        FROM public.sales_documents
        GROUP BY status_logistic
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  % : % records', RPAD(COALESCE(v_record.status_logistic, '(null)'), 20), v_record.count;
    END LOOP;
    RAISE NOTICE '';

    -- sales_documents.status_fiscal
    RAISE NOTICE 'status_fiscal distribution:';
    FOR v_record IN 
        SELECT status_fiscal, COUNT(*) as count
        FROM public.sales_documents
        GROUP BY status_fiscal
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  % : % records', RPAD(COALESCE(v_record.status_fiscal, '(null)'), 20), v_record.count;
    END LOOP;
    RAISE NOTICE '';

    -- sales_documents.financial_status
    RAISE NOTICE 'financial_status distribution:';
    FOR v_record IN 
        SELECT financial_status, COUNT(*) as count
        FROM public.sales_documents
        GROUP BY financial_status
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  % : % records', RPAD(COALESCE(v_record.financial_status, '(null)'), 20), v_record.count;
    END LOOP;
    RAISE NOTICE '';

    -- purchase_orders.status
    RAISE NOTICE 'purchase_orders.status distribution:';
    FOR v_record IN 
        SELECT status, COUNT(*) as count
        FROM public.purchase_orders
        GROUP BY status
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  % : % records', RPAD(COALESCE(v_record.status, '(null)'), 20), v_record.count;
    END LOOP;
END $$;

-- ========================================
-- STEP 3: Identify Problematic Values
-- ========================================

DO $$
DECLARE
    v_count INTEGER;
    v_values TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 3: Values Requiring Normalization';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Check for EN values in status_logistic
    RAISE NOTICE 'Checking status_logistic for EN values...';
    
    SELECT COUNT(*), STRING_AGG(DISTINCT status_logistic, ', ')
    INTO v_count, v_values
    FROM public.sales_documents
    WHERE status_logistic IN ('pending', 'separation', 'expedition', 'delivered');
    
    IF v_count > 0 THEN
        RAISE WARNING '  Found % records with EN values: %', v_count, v_values;
    ELSE
        RAISE NOTICE '  ✓ No EN values found';
    END IF;

    -- Check for unknown values in status_logistic
    SELECT COUNT(*), STRING_AGG(DISTINCT status_logistic, ', ')
    INTO v_count, v_values
    FROM public.sales_documents
    WHERE status_logistic NOT IN (
        'pending', 'roteirizado', 'agendado', 'em_rota', 'entregue', 'devolvido', 'parcial',
        'pending', 'separation', 'expedition', 'delivered'
    );
    
    IF v_count > 0 THEN
        RAISE WARNING '  ⚠️  UNKNOWN VALUES IN status_logistic: % records', v_count;
        RAISE WARNING '  ⚠️  Values: %', SUBSTRING(v_values, 1, 200);
        RAISE WARNING '  ⚠️  ABORT MIGRATION - Unknown values must be investigated!';
    ELSE
        RAISE NOTICE '  ✓ All values are known (PT-BR or EN)';
    END IF;
    RAISE NOTICE '';

    -- Check for EN values in financial_status
    RAISE NOTICE 'Checking financial_status for EN values...';
    
    SELECT COUNT(*), STRING_AGG(DISTINCT financial_status, ', ')
    INTO v_count, v_values
    FROM public.sales_documents
    WHERE financial_status = 'pending';
    
    IF v_count > 0 THEN
        RAISE WARNING '  Found % records with "pending"', v_count;
    ELSE
        RAISE NOTICE '  ✓ No "pending" value found';
    END IF;

    -- Check for unknown values in financial_status
    SELECT COUNT(*), STRING_AGG(DISTINCT financial_status, ', ')
    INTO v_count, v_values
    FROM public.sales_documents
    WHERE financial_status IS NOT NULL
    AND financial_status NOT IN (
        'pending', 'pre_lancado', 'approved', 'em_revisao', 'cancelado',
        'pending'
    );
    
    IF v_count > 0 THEN
        RAISE WARNING '  ⚠️  UNKNOWN VALUES IN financial_status: % records', v_count;
        RAISE WARNING '  ⚠️  Values: %', SUBSTRING(v_values, 1, 200);
        RAISE WARNING '  ⚠️  ABORT MIGRATION - Unknown values must be investigated!';
    ELSE
        RAISE NOTICE '  ✓ All values are known (PT-BR or EN)';
    END IF;
END $$;

-- ========================================
-- STEP 4: Context Analysis for 'expedition'
-- ========================================

DO $$
DECLARE
    v_count_with_route INTEGER;
    v_count_total INTEGER;
    v_has_route_tables BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 4: Context for "expedition" Mapping';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Check if route tables exist
    IF to_regclass('public.delivery_route_orders') IS NOT NULL 
       AND to_regclass('public.delivery_routes') IS NOT NULL THEN
        v_has_route_tables := TRUE;
    END IF;

    -- Count how many 'expedition' records exist
    SELECT COUNT(*) INTO v_count_total
    FROM public.sales_documents
    WHERE status_logistic = 'expedition';

    IF v_count_total > 0 THEN
        RAISE NOTICE 'Found % records with status_logistic = "expedition"', v_count_total;
        
        IF v_has_route_tables THEN
            -- Check if these records are in active routes
            SELECT COUNT(*) INTO v_count_with_route
            FROM public.sales_documents sd
            LEFT JOIN public.delivery_route_orders dro ON dro.sales_document_id = sd.id
            LEFT JOIN public.delivery_routes dr ON dr.id = dro.route_id
            WHERE sd.status_logistic = 'expedition'
            AND dr.id IS NOT NULL
            AND dr.status NOT IN ('cancelled', 'completed');

            IF v_count_with_route > 0 THEN
                RAISE NOTICE '  → % have active routes → recommend map to "em_rota"', v_count_with_route;
                RAISE NOTICE '  → % without routes → recommend map to "roteirizado"', (v_count_total - v_count_with_route);
            ELSE
                RAISE NOTICE '  → All % records have NO active routes', v_count_total;
                RAISE NOTICE '  → Recommended mapping: "roteirizado" (conservative)';
            END IF;
        ELSE
            RAISE NOTICE '  → Route tables not found in this environment';
            RAISE NOTICE '  → Recommended mapping: "roteirizado" (conservative)';
        END IF;
    ELSE
        RAISE NOTICE '✓ No "expedition" values found - skipping context analysis';
    END IF;
END $$;

-- ========================================
-- STEP 5: Summary and Recommendations
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SUMMARY & NEXT STEPS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Review the output above and:';
    RAISE NOTICE '1. ✅ Verify all constraint names and definitions';
    RAISE NOTICE '2. ⚠️  Check for any UNKNOWN values (must be zero!)';
    RAISE NOTICE '3. 📋 Review "expedition" → PT-BR mapping recommendation';
    RAISE NOTICE '4. ✅ If all clear, proceed with normalization migration';
    RAISE NOTICE '5. 🛑 If unknown values found, ABORT and investigate first';
    RAISE NOTICE '';
    RAISE NOTICE 'NOTE: Migration will RAISE EXCEPTION if unknowns detected';
    RAISE NOTICE '';
END $$;

ROLLBACK; -- This is diagnostic only, no changes made
