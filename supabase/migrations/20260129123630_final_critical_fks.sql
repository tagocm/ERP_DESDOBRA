-- Final Sprint: Remaining Critical FKs
-- Goal: Add FKs for sales_document_items → items, sales_documents → payment_terms/price_tables
-- Risk: Low - these are fundamental relationships
-- Estimated Time: 20min

BEGIN;

-- ========================================
-- FK 1: sales_document_items.item_id → items
-- ========================================

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM sales_document_items sdi
  WHERE sdi.item_id NOT IN (SELECT id FROM items);
  
  RAISE NOTICE 'Found % sales items with invalid item_id', orphan_count;
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'Found orphaned sales items - CRITICAL';
    RAISE EXCEPTION 'Data integrity issue - manual review required';
  END IF;
  
  -- Add FK (or skip if already exists)
  BEGIN
    ALTER TABLE sales_document_items
    ADD CONSTRAINT fk_sales_item_product
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT;
    RAISE NOTICE '✅ FK sales_document_items → items added';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE '⏭️  FK sales_document_items → items already exists';
  END;
END $$;

-- ========================================
-- FK 2: sales_documents.payment_terms_id → payment_terms
-- ========================================

DO $$
DECLARE
  orphan_count INTEGER;
  table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_terms'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE 'payment_terms table does not exist, skipping';
    RETURN;
  END IF;
  
  SELECT COUNT(*) INTO orphan_count
  FROM sales_documents
  WHERE payment_terms_id IS NOT NULL
    AND payment_terms_id NOT IN (SELECT id FROM payment_terms);
  
  RAISE NOTICE 'Found % sales docs with invalid payment_terms_id', orphan_count;
  
  IF orphan_count > 0 THEN
    UPDATE sales_documents
    SET payment_terms_id = NULL
    WHERE payment_terms_id NOT IN (SELECT id FROM payment_terms);
    RAISE NOTICE 'Cleaned % orphaned references', orphan_count;
  END IF;
  
  BEGIN
    ALTER TABLE sales_documents
    ADD CONSTRAINT fk_sales_doc_payment_terms
    FOREIGN KEY (payment_terms_id) REFERENCES payment_terms(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ FK sales_documents → payment_terms added';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE '⏭️  FK sales_documents → payment_terms already exists';
  END;
END $$;

-- ========================================
-- FK 3: sales_documents.price_table_id → price_tables
-- ========================================

DO $$
DECLARE
  orphan_count INTEGER;
  table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'price_tables'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE 'price_tables table does not exist, skipping';
    RETURN;
  END IF;
  
  SELECT COUNT(*) INTO orphan_count
  FROM sales_documents
  WHERE price_table_id IS NOT NULL
    AND price_table_id NOT IN (SELECT id FROM price_tables);
  
  RAISE NOTICE 'Found % sales docs with invalid price_table_id', orphan_count;
  
  IF orphan_count > 0 THEN
    UPDATE sales_documents
    SET price_table_id = NULL
    WHERE price_table_id NOT IN (SELECT id FROM price_tables);
    RAISE NOTICE 'Cleaned % orphaned references', orphan_count;
  END IF;
  
  BEGIN
    ALTER TABLE sales_documents
    ADD CONSTRAINT fk_sales_doc_price_table
    FOREIGN KEY (price_table_id) REFERENCES price_tables(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ FK sales_documents → price_tables added';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE '⏭️  FK sales_documents → price_tables already exists';
  END;
END $$;

COMMIT;

-- Rollback (if needed):
-- ALTER TABLE sales_document_items DROP CONSTRAINT fk_sales_item_product;
-- ALTER TABLE sales_documents DROP CONSTRAINT fk_sales_doc_payment_terms;
-- ALTER TABLE sales_documents DROP CONSTRAINT fk_sales_doc_price_table;
