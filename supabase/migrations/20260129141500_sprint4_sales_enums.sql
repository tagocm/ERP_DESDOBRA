-- Sprint 4: Status ENUMs Type Safety
-- Objective: Transition status_commercial from TEXT to ENUM for better data integrity

BEGIN;

-- 1. Create the ENUM type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_commercial_status') THEN
        CREATE TYPE public.sales_commercial_status AS ENUM (
            'draft', 'sent', 'approved', 'confirmed', 'rejected', 'cancelled', 'lost'
        );
    END IF;
END $$;

-- 2. Add temporary column to sales_documents
ALTER TABLE public.sales_documents
ADD COLUMN IF NOT EXISTS status_commercial_new public.sales_commercial_status;

-- 3. Backfill data from TEXT to ENUM
-- Note: Cast works automatically for values present in the ENUM
UPDATE public.sales_documents
SET status_commercial_new = status_commercial::public.sales_commercial_status
WHERE status_commercial IS NOT NULL 
  AND status_commercial IN ('draft', 'sent', 'approved', 'confirmed', 'rejected', 'cancelled', 'lost');

-- 4. Mark legacy values that don't match (if any) as draft or investigate
-- In dev environment, we assume strict adherence or fallback to draft
UPDATE public.sales_documents
SET status_commercial_new = 'draft'
WHERE status_commercial_new IS NULL AND status_commercial IS NOT NULL;

-- 5. Add NOT NULL constraint once backfilled
ALTER TABLE public.sales_documents
ALTER COLUMN status_commercial_new SET NOT NULL;

-- 6. Important: Renaming/dropping columns requires application code changes.
-- We will keep both columns for now to prevent breakage during migration.
-- A follow-up task will switch the code to use the new column.

COMMIT;
