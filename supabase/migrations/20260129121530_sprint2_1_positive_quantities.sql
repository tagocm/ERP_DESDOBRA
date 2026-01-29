-- Sprint 2, Step 2.1: Add positive quantity checks
-- Goal: Ensure all quantities and delivered amounts are valid
-- Risk: Low - validates business logic, prevents invalid data entry
-- Estimated Time: 10min

BEGIN;

-- Pre-check: Find existing invalid data
DO $$
DECLARE
  invalid_sales_items INTEGER;
  invalid_delivery_items INTEGER;
BEGIN
  -- Check sales_document_items
  SELECT COUNT(*) INTO invalid_sales_items
  FROM sales_document_items 
  WHERE quantity <= 0;
  
  RAISE NOTICE 'Found % sales items with invalid quantity (<=0)', invalid_sales_items;
  
  -- Check delivery_items if table exists
  SELECT COUNT(*) INTO invalid_delivery_items
  FROM delivery_items 
  WHERE qty_delivered < 0;
  
  RAISE NOTICE 'Found % delivery items with negative qty_delivered', invalid_delivery_items;
  
  -- Warn if data needs manual review
  IF invalid_sales_items > 0 OR invalid_delivery_items > 0 THEN
    RAISE WARNING 'Found invalid data - please review before adding constraints';
    RAISE EXCEPTION 'Invalid data found - manual review required';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'delivery_items table does not exist, skipping check';
END $$;

-- Add constraint to sales_document_items
ALTER TABLE sales_document_items
ADD CONSTRAINT chk_quantity_positive 
CHECK (quantity > 0);

-- Add constraint to delivery_items (if exists)
DO $$
BEGIN
  ALTER TABLE delivery_items
  ADD CONSTRAINT chk_delivered_non_negative 
  CHECK (qty_delivered >= 0);
  
  RAISE NOTICE '✅ Added constraint to delivery_items';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'delivery_items table does not exist, skipping constraint';
END $$;

-- Verify constraints were added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_quantity_positive'
  ) THEN
    RAISE NOTICE '✅ CHECK constraint chk_quantity_positive successfully added';
  ELSE
    RAISE EXCEPTION '❌ CHECK constraint was not added';
  END IF;
END $$;

COMMIT;

-- Rollback instructions (if needed):
-- ALTER TABLE sales_document_items DROP CONSTRAINT chk_quantity_positive;
-- ALTER TABLE delivery_items DROP CONSTRAINT chk_delivered_non_negative;
