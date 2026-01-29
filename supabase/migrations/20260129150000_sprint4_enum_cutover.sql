-- Sprint 4: Status ENUM Final Cutover
-- Objective: Remove legacy TEXT columns and rename new ENUM columns to primary names.
-- This enforces type safety and cleans up the schema.

BEGIN;

-- 1. Drop old columns
ALTER TABLE public.sales_documents DROP COLUMN IF EXISTS status_commercial;
ALTER TABLE public.sales_documents DROP COLUMN IF EXISTS status_logistic;
ALTER TABLE public.sales_documents DROP COLUMN IF EXISTS financial_status;

-- 2. Rename new columns to primary names
ALTER TABLE public.sales_documents RENAME COLUMN status_commercial_new TO status_commercial;
ALTER TABLE public.sales_documents RENAME COLUMN status_logistic_new TO status_logistic;
ALTER TABLE public.sales_documents RENAME COLUMN financial_status_new TO financial_status;

-- 3. Update Indexes (Optional but good for cleanliness)
-- The indexes created in Sprint 5 already use the _new names. 
-- Renaming columns automatically updates references in indexes in PostgreSQL.
-- Let's double check if we want to rename the index names too.
ALTER INDEX idx_sales_docs_reporting RENAME TO idx_sales_docs_reporting_final;
ALTER INDEX idx_sales_docs_logistic_pending RENAME TO idx_sales_docs_logistic_pending_final;

-- 4. Update any triggers that were using the old names or need adjustment
-- Triggers are already using status_logistic (which is now the enum).
-- If we had triggers explicitly referencing _new in the code (which we shouldn't have in SQL), we would update them.

COMMIT;
