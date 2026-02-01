-- Sprint 5: Advanced Indexing (Steps 5.1-5.3 combined)
-- Goal: Add composite and partial indexes for common query patterns
-- Risk: Low - indexes are non-breaking, only improve performance
-- Estimated Time: 30min

BEGIN;

-- ========================================
-- Step 5.1: Composite index for order date range queries
-- ========================================

-- Common pattern: List orders by company, filtered by date range and status
CREATE INDEX IF NOT EXISTS idx_sales_docs_company_date_status
ON sales_documents(company_id, date_issued DESC, status_commercial)
WHERE deleted_at IS NULL;

-- ========================================
-- Step 5.2: Partial index for overdue AR
-- ========================================

-- Common pattern: Aging reports - find overdue receivables
CREATE INDEX IF NOT EXISTS idx_ar_overdue
ON ar_installments(company_id, due_date ASC)
WHERE status = 'OPEN';

-- Same for AP
CREATE INDEX IF NOT EXISTS idx_ap_overdue
ON ap_installments(company_id, due_date ASC)
WHERE status = 'OPEN';

-- ========================================
-- Step 5.3: Covering index for financial events approval queue
-- ========================================

-- Common pattern: Financial pre-approval screen queries
CREATE INDEX IF NOT EXISTS idx_financial_events_approval_queue
ON financial_events(company_id, status, created_at DESC)
WHERE status IN ('pending', 'attention');

-- ========================================
-- Additional useful indexes
-- ========================================

-- Active items search (for product selector)
CREATE INDEX IF NOT EXISTS idx_items_active_search
ON items(company_id, name)
WHERE deleted_at IS NULL;

-- Active organizations search (for client/supplier selector)  
CREATE INDEX IF NOT EXISTS idx_organizations_active_search
ON organizations(company_id, trade_name)
WHERE deleted_at IS NULL;

-- Verify indexes were created
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE indexname IN (
    'idx_sales_docs_company_date_status',
    'idx_ar_overdue',
    'idx_ap_overdue',
    'idx_financial_events_approval_queue',
    'idx_items_active_search',
    'idx_organizations_active_search'
  );
  
  IF index_count >= 5 THEN
    RAISE NOTICE '✅ Advanced indexes successfully created (% of 6)', index_count;
  ELSE
    RAISE WARNING 'Only % of 6 indexes were created', index_count;
  END IF;
END $$;

COMMIT;

-- Rollback instructions (if needed):
-- DROP INDEX IF EXISTS idx_sales_docs_company_date_status;
-- DROP INDEX IF EXISTS idx_ar_overdue;
-- DROP INDEX IF EXISTS idx_ap_overdue;
-- DROP INDEX IF EXISTS idx_financial_events_approval_queue;
-- DROP INDEX IF EXISTS idx_items_active_search;
-- DROP INDEX IF EXISTS idx_organizations_active_search;
