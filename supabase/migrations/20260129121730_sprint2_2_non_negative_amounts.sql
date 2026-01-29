-- Sprint 2, Step 2.2: Add non-negative amount checks
-- Goal: Ensure discounts and amounts are valid (>= 0)  
-- Risk: Low - validates business logic
-- Estimated Time: 10min

BEGIN;

-- Pre-check: Find existing invalid data
DO $$
DECLARE
  invalid_items_total INTEGER;
  invalid_items_discount INTEGER;
  invalid_docs_amounts INTEGER;
BEGIN
  -- Check sales_document_items total_amount
  SELECT COUNT(*) INTO invalid_items_total
  FROM sales_document_items 
  WHERE total_amount < 0;
  
  RAISE NOTICE 'Found % sales items with negative total_amount', invalid_items_total;
  
  -- Check sales_document_items discount_amount
  SELECT COUNT(*) INTO invalid_items_discount
  FROM sales_document_items 
  WHERE discount_amount < 0;
  
  RAISE NOTICE 'Found % sales items with negative discount_amount', invalid_items_discount;
  
  -- Check sales_documents amounts
  SELECT COUNT(*) INTO invalid_docs_amounts
  FROM sales_documents 
  WHERE subtotal_amount < 0 OR freight_amount < 0 OR total_amount < 0;
  
  RAISE NOTICE 'Found % sales documents with negativeavalues', invalid_docs_amounts;
  
  -- Warn if data needs manual review
  IF invalid_items_total > 0 OR invalid_items_discount > 0 OR invalid_docs_amounts > 0 THEN
    RAISE WARNING 'Found invalid data - please review before adding constraints';
    RAISE EXCEPTION 'Invalid data found - manual review required';
  END IF;
END $$;

-- Add constraint to sales_document_items (discount must be non-negative)
ALTER TABLE sales_document_items
ADD CONSTRAINT chk_discount_non_negative 
CHECK (discount_amount >= 0);

-- Add constraint to sales_documents (amounts must be non-negative)
ALTER TABLE sales_documents
ADD CONSTRAINT chk_amounts_non_negative 
CHECK (
  subtotal_amount >= 0 
  AND freight_amount >= 0
  AND total_amount >= 0
);

-- Verify constraints were added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_discount_non_negative'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_amounts_non_negative'
  ) THEN
    RAISE NOTICE '✅ CHECK constraints successfully added';
  ELSE
    RAISE EXCEPTION '❌ CHECK constraints were not added';
  END IF;
END $$;

COMMIT;

-- Rollback instructions (if needed):
-- ALTER TABLE sales_document_items DROP CONSTRAINT chk_discount_non_negative;
-- ALTER TABLE sales_documents DROP CONSTRAINT chk_amounts_non_negative;
