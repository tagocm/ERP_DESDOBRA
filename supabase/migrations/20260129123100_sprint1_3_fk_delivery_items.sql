-- Sprint 1, Step 1.3: Add FK for delivery_items.sales_document_item_id
-- Goal: Ensure delivery items always reference valid sales order items
-- Risk: Medium - critical FK, may have orphans
-- Estimated Time: 20min

BEGIN;

-- Pre-check: Find orphaned delivery items
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM delivery_items di
  LEFT JOIN sales_document_items sdi ON di.sales_document_item_id = sdi.id
  WHERE di.sales_document_item_id IS NOT NULL
    AND sdi.id IS NULL;
  
  RAISE NOTICE 'Found % orphaned delivery items (invalid sales_document_item_id)', orphan_count;
  
  -- If orphans found, this is a DATA INTEGRITY ISSUE that needs manual review
  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % orphaned delivery items - CRITICAL DATA ISSUE', orphan_count;
    RAISE EXCEPTION 'Orphaned delivery items found - manual review required before adding FK';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'delivery_items table does not exist, skipping migration';
    -- Exit gracefully if table doesn't exist
    RETURN;
END $$;

-- Add foreign key constraint (only if table exists and no orphans)
DO $$
BEGIN
  ALTER TABLE delivery_items
  ADD CONSTRAINT fk_delivery_item_sales_item
  FOREIGN KEY (sales_document_item_id)
  REFERENCES sales_document_items(id)
  ON DELETE CASCADE;
  
  RAISE NOTICE '✅ FK constraint fk_delivery_item_sales_item successfully added';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'delivery_items table does not exist, skipping FK creation';
  WHEN others THEN
    RAISE;
END $$;

-- Verify constraint was added (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_delivery_item_sales_item'
      AND table_name = 'delivery_items'
  ) THEN
    RAISE NOTICE '✅ Verification passed - FK constraint is active';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'delivery_items'
  ) THEN
    RAISE WARNING 'delivery_items exists but FK was not added';
  ELSE
    RAISE NOTICE 'delivery_items table does not exist - migration skipped';
  END IF;
END $$;

COMMIT;

-- Rollback instructions (if needed):
-- ALTER TABLE delivery_items DROP CONSTRAINT fk_delivery_item_sales_item;
