-- Sprint 2, Step 2.4: Add installment amount validation
-- Goal: Ensure AR/AP installment amounts are always positive
-- Risk: Low - validates financial business logic
-- Estimated Time: 10min

BEGIN;

-- Pre-check: Find existing invalid data
DO $$
DECLARE
  invalid_ar INTEGER;
  invalid_ap INTEGER;
BEGIN
  -- Check AR installments (using correct column name: amount_original)
  SELECT COUNT(*) INTO invalid_ar
  FROM ar_installments 
  WHERE amount_original <= 0;
  
  RAISE NOTICE 'Found % AR installments with amount_original <= 0', invalid_ar;
  
  -- Check AP installments
  SELECT COUNT(*) INTO invalid_ap
  FROM ap_installments 
  WHERE amount_original <= 0;
  
  RAISE NOTICE 'Found % AP installments with amount_original <= 0', invalid_ap;
  
  -- Warn if data needs manual review
  IF invalid_ar > 0 OR invalid_ap > 0 THEN
    RAISE WARNING 'Found invalid installment amounts - please review before adding constraints';
    RAISE EXCEPTION 'Invalid data found - manual review required';
  END IF;
END $$;

-- Add constraint to ar_installments
ALTER TABLE ar_installments
ADD CONSTRAINT chk_ar_amount_positive 
CHECK (amount_original > 0);

-- Add constraint to ap_installments  
ALTER TABLE ap_installments
ADD CONSTRAINT chk_ap_amount_positive 
CHECK (amount_original > 0);

-- Verify constraints were added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_ar_amount_positive'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_ap_amount_positive'
  ) THEN
    RAISE NOTICE '✅ CHECK constraints for installment amounts successfully added';
  ELSE
    RAISE EXCEPTION '❌ CHECK constraints were not added';
  END IF;
END $$;

COMMIT;

-- Rollback instructions (if needed):
-- ALTER TABLE ar_installments DROP CONSTRAINT chk_ar_amount_positive;
-- ALTER TABLE ap_installments DROP CONSTRAINT chk_ap_amount_positive;
