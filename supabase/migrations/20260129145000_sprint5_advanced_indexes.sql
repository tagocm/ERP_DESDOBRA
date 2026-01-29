-- Sprint 5: Performance Optimization (Advanced Indexing)
-- Objective: Speed up critical query paths for reports, dashboards, and queues

BEGIN;

-- 1. Composite index for order date range queries and reporting
-- Speeds up: "Find all approved orders for company X in date range Y"
CREATE INDEX IF NOT EXISTS idx_sales_docs_reporting
ON public.sales_documents(company_id, date_issued DESC, status_commercial_new)
WHERE deleted_at IS NULL;

-- 2. Partial index for Open Accounts Receivable (AR)
-- Speeds up: "List all open installments"
CREATE INDEX IF NOT EXISTS idx_ar_installments_open
ON public.ar_installments(company_id, due_date)
WHERE status = 'OPEN';

-- 3. Covering index for Financial Events Approval Queue
-- Speeds up: "Show the unified approval queue for finance team"
CREATE INDEX IF NOT EXISTS idx_financial_events_approval_queue
ON public.financial_events(company_id, status, created_at DESC)
WHERE status IN ('pendente', 'em_atencao');

-- 4. Composite index for Sales Order History lookup (SAFE CHECK)
-- Speeds up: Audit trails and recent activity feeds
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_document_history') THEN
        CREATE INDEX IF NOT EXISTS idx_sales_order_history_record_date
        ON public.sales_document_history(document_id, created_at DESC);
    ELSIF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_document_events') THEN
        CREATE INDEX IF NOT EXISTS idx_sales_order_events_record_date
        ON public.sales_document_events(document_id, created_at DESC);
    END IF;
END $$;

-- 5. Partial index for Logistics Sandbox (Pendente status)
-- Speeds up: The logistics dashboard where orders wait for fulfillment
CREATE INDEX IF NOT EXISTS idx_sales_docs_logistic_pending
ON public.sales_documents(company_id, created_at DESC)
WHERE status_logistic_new = 'pendente' AND deleted_at IS NULL;

COMMIT;
