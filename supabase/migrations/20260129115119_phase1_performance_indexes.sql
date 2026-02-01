-- Phase 1: Performance Optimization - Strategic Indexes
-- Migration: Add indexes on frequently-filtered and joined columns
-- Risk: Low (indexes are non-breaking, easily reversible)
-- Impact: Improves query performance on status filters, date ranges, and audit trails

-- ========================================
-- FINANCIAL EVENTS
-- ========================================

-- Frequently filtered by status in approval screens
CREATE INDEX IF NOT EXISTS idx_financial_events_status 
  ON financial_events(status) 
  WHERE status IN ('pending', 'attention');

-- Filtering by direction (AR vs AP) with company scoping
CREATE INDEX IF NOT EXISTS idx_financial_events_direction 
  ON financial_events(direction, company_id);

-- Date-based queries for financial dashboards
CREATE INDEX IF NOT EXISTS idx_financial_events_issue_date 
  ON financial_events(company_id, issue_date DESC);

-- ========================================
-- AUDIT LOGS
-- ========================================

-- Most common audit query: recent actions by company (if columns exist)
-- Note: Removed entity_type/entity_id indexes as these columns don't exist in current schema
-- CREATE INDEX IF NOT EXISTS idx_audit_logs_company_date 
--   ON audit_logs(company_id, created_at DESC);

-- User activity history (if columns exist)
-- CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date 
--   ON audit_logs(user_id, created_at DESC) 
--   WHERE user_id IS NOT NULL;


-- ========================================
-- SALES DOCUMENTS
-- ========================================

-- Client order history with status filtering (removed WHERE clause to avoid errors)
CREATE INDEX IF NOT EXISTS idx_sales_documents_client_status 
  ON sales_documents(client_id, status_commercial);

-- Order listing sorted by date
CREATE INDEX IF NOT EXISTS idx_sales_documents_date_issued 
  ON sales_documents(company_id, date_issued DESC);

-- ========================================
-- ITEMS (PRODUCTS)  
-- ========================================

-- Product search by company and name (simplified, no WHERE clause)
CREATE INDEX IF NOT EXISTS idx_items_company_name 
  ON items(company_id, name);

-- ========================================
-- FINANCIAL INSTALLMENTS
-- ========================================

-- AR installments by company and due date
CREATE INDEX IF NOT EXISTS idx_ar_installments_company_due 
  ON ar_installments(company_id, due_date DESC);

-- AP installments by company and due date
CREATE INDEX IF NOT EXISTS idx_ap_installments_company_due 
  ON ap_installments(company_id, due_date DESC);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Run these to verify index usage after deployment:
--
-- EXPLAIN ANALYZE 
-- SELECT * FROM financial_events 
-- WHERE status = 'pending' AND company_id = 'xxx';
--
-- EXPLAIN ANALYZE 
-- SELECT * FROM sales_documents 
-- WHERE client_id = 'xxx' AND status_commercial = 'confirmed';
--
-- Expected: Should show "Index Scan" instead of "Seq Scan"
-- ========================================

