-- Sprint 2, Step 2.3: Add date logic validation
-- Goal: Ensure valid_until is always >= date_issued (business logic)
-- Risk: Medium - may have existing violations in production data
-- Estimated Time: 15min

BEGIN;

-- Pre-check: Find existing violations
DO $$
DECLARE
  violation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO violation_count
  FROM sales_documents 
  WHERE valid_until IS NOT NULL 
    AND valid_until < date_issued;
  
  RAISE NOTICE 'Found % documents with valid_until < date_issued', violation_count;
  
  -- Fix violations by setting valid_until to NULL
  IF violation_count > 0 THEN
    UPDATE sales_documents 
    SET valid_until = NULL 
    WHERE valid_until IS NOT NULL 
      AND valid_until < date_issued;
    
    RAISE NOTICE 'Fixed % violations by setting valid_until to NULL', violation_count;
  END IF;
END $$;

-- Add constraint
ALTER TABLE sales_documents
ADD CONSTRAINT chk_valid_until_after_issued
CHECK (valid_until IS NULL OR valid_until >= date_issued);

-- Verify constraint was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_valid_until_after_issued'
  ) THEN
    RAISE NOTICE '✅ CHECK constraint chk_valid_until_after_issued successfully added';
  ELSE
    RAISE EXCEPTION '❌ CHECK constraint was not added';
  END IF;
END $$;

COMMIT;

-- Rollback instructions (if needed):
-- ALTER TABLE sales_documents DROP CONSTRAINT chk_valid_until_after_issued;
