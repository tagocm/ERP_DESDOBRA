
-- Fix: audit_logs resource column constraint
-- Issue: Legacy audit_logs table (20251228) has 'resource' column with NOT NULL constraint.
-- Newer triggers (20260129) do not provide this column, causing insertion failures.
-- Solution: Make 'resource' column nullable if it exists.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs' 
        AND column_name = 'resource'
    ) THEN
        ALTER TABLE public.audit_logs ALTER COLUMN resource DROP NOT NULL;
        RAISE NOTICE 'Made audit_logs.resource column nullable';
    END IF;
END$$;

COMMIT;
