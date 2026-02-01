-- Fix: audit_logs entity column constraint
-- Issue: Local database has 'entity' column with NOT NULL constraint
-- Solution: Make column nullable if exists, or ensure trigger doesn't fail

BEGIN;

-- Check if entity column exists and make it nullable
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs' 
        AND column_name = 'entity'
    ) THEN
        -- Make the column nullable
        ALTER TABLE public.audit_logs ALTER COLUMN entity DROP NOT NULL;
        
        RAISE NOTICE 'Made audit_logs.entity column nullable';
    ELSE
        RAISE NOTICE 'Column audit_logs.entity does not exist - no action needed';
    END IF;
END$$;

COMMIT;
