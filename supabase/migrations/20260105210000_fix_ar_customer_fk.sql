-- Fix AR Titles Customer Relationship (organizations)
-- Addresses PGRST200 error: "Searched for a foreign key relationship between 'ar_titles' and 'organizations'..."

BEGIN;

-- 1. Cleanup Orphans: Delete ar_titles pointing to non-existent customers
-- (This is aggressive but necessary to ensure FK integrity if data is corrupted)
DELETE FROM public.ar_titles 
WHERE customer_id NOT IN (SELECT id FROM public.organizations);

-- 2. Force Recreate FK for customer_id
DO $$
BEGIN
    -- Drop if exists (to fully reset likely broken state)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ar_titles_customer_id_fkey') THEN
        ALTER TABLE public.ar_titles DROP CONSTRAINT ar_titles_customer_id_fkey;
    END IF;
    
    -- Add Constraint
    ALTER TABLE public.ar_titles 
    ADD CONSTRAINT ar_titles_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
END $$;

-- Force Schema Reload
NOTIFY pgrst, 'reload schema';

COMMIT;
