-- Complete the ENUM Column Swap for sales_documents
-- This migration completes what 20260129144500 started
-- IDEMPOTENT: Handles all possible schema states

BEGIN;

-- Helper function to check column existence
DO $$
DECLARE
    has_old_logistic BOOLEAN;
    has_new_logistic BOOLEAN;
    has_old_financial BOOLEAN;
    has_new_financial BOOLEAN;
BEGIN
    -- Check what columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_documents' AND column_name = 'status_logistic'
        AND data_type = 'text'
    ) INTO has_old_logistic;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_documents' AND column_name = 'status_logistic_new'
    ) INTO has_new_logistic;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_documents' AND column_name = 'financial_status'
        AND data_type = 'text'
    ) INTO has_old_financial;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_documents' AND column_name = 'financial_status_new'
    ) INTO has_new_financial;
    
    RAISE NOTICE 'Schema State: old_logistic=%, new_logistic=%, old_financial=%, new_financial=%', 
        has_old_logistic, has_new_logistic, has_old_financial, has_new_financial;
    
    -- SCENARIO 1: Both old and new exist (incomplete migration)
    IF has_old_logistic AND has_new_logistic THEN
        RAISE NOTICE 'Dropping old status_logistic TEXT column';
        EXECUTE 'ALTER TABLE public.sales_documents DROP COLUMN status_logistic CASCADE';
        EXECUTE 'ALTER TABLE public.sales_documents RENAME COLUMN status_logistic_new TO status_logistic';
    ELSIF has_new_logistic AND NOT has_old_logistic THEN
        -- Only new exists, just rename
        RAISE NOTICE 'Renaming status_logistic_new to status_logistic';
        EXECUTE 'ALTER TABLE public.sales_documents RENAME COLUMN status_logistic_new TO status_logistic';
    END IF;
    
    IF has_old_financial AND has_new_financial THEN
        RAISE NOTICE 'Dropping old financial_status TEXT column';
        EXECUTE 'ALTER TABLE public.sales_documents DROP COLUMN financial_status CASCADE';
        EXECUTE 'ALTER TABLE public.sales_documents RENAME COLUMN financial_status_new TO financial_status';
    ELSIF has_new_financial AND NOT has_old_financial THEN
        -- Only new exists, just rename
        RAISE NOTICE 'Renaming financial_status_new to financial_status';
        EXECUTE 'ALTER TABLE public.sales_documents RENAME COLUMN financial_status_new TO financial_status';
    END IF;
    
    -- Set defaults if columns now exist with correct names
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_documents' AND column_name = 'status_logistic'
        AND udt_name = 'sales_logistic_status'
    ) THEN
        RAISE NOTICE 'Setting default for status_logistic';
        EXECUTE 'ALTER TABLE public.sales_documents ALTER COLUMN status_logistic SET DEFAULT ''pending''';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_documents' AND column_name = 'financial_status'
        AND udt_name = 'financial_status_enum'
    ) THEN
        RAISE NOTICE 'Setting default for financial_status';
        EXECUTE 'ALTER TABLE public.sales_documents ALTER COLUMN financial_status SET DEFAULT ''pending''';
    END IF;
END $$;

COMMIT;

