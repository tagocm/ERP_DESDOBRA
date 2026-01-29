-- Sprint 1, Step 1.4: Add FK for financial_event_installments.payment_method_id
-- Goal: Ensure installments reference valid payment methods
-- Risk: Low - graceful handling if table doesn't exist
-- Estimated Time: 15min

BEGIN;

-- Pre-check: Find orphaned records (if payment_methods table exists)
DO $$
DECLARE
  orphan_count INTEGER := 0;
  payment_methods_exists BOOLEAN;
BEGIN
  -- Check if payment_methods table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'payment_methods'
  ) INTO payment_methods_exists;
  
  IF NOT payment_methods_exists THEN
    RAISE NOTICE 'payment_methods table does not exist - skipping migration';
    RETURN;
  END IF;
  
  -- Check for orphans
  SELECT COUNT(*) INTO orphan_count
  FROM financial_event_installments
  WHERE payment_method_id IS NOT NULL
    AND payment_method_id NOT IN (SELECT id FROM payment_methods);
  
  RAISE NOTICE 'Found % orphaned payment_method_id records', orphan_count;
  
  -- Clean orphans by setting to NULL
  IF orphan_count > 0 THEN
    UPDATE financial_event_installments
    SET payment_method_id = NULL
    WHERE payment_method_id IS NOT NULL
      AND payment_method_id NOT IN (SELECT id FROM payment_methods);
    
    RAISE NOTICE 'Cleaned % orphaned records', orphan_count;
  END IF;
END $$;

-- Add foreign key constraint (if payment_methods exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'payment_methods'
  ) THEN
    ALTER TABLE financial_event_installments
    ADD CONSTRAINT fk_installment_payment_method
    FOREIGN KEY (payment_method_id)
    REFERENCES payment_methods(id)
    ON DELETE SET NULL;
    
    RAISE NOTICE '✅ FK constraint fk_installment_payment_method successfully added';
  ELSE
    RAISE NOTICE 'payment_methods table does not exist - FK not created';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'FK constraint already exists, skipping';
  WHEN others THEN
    RAISE;
END $$;

-- Verify constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_installment_payment_method'
  ) THEN
    RAISE NOTICE '✅ Verification passed - FK constraint is active';
  END IF;
END $$;

COMMIT;

-- Rollback instructions (if needed):
-- ALTER TABLE financial_event_installments DROP CONSTRAINT fk_installment_payment_method;
