-- Migration: Fix UOMs Foreign Key and RLS
-- Description: Explicitly ensures the FK constraint exists with a standard name and updates RLS to allow global UOMs.

DO $$
BEGIN
    -- 0. Ensure uom_id exists on items
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'uom_id') THEN
        ALTER TABLE public.items ADD COLUMN uom_id UUID;
    END IF;

    -- 1. Fix Foreign Key Name for PostgREST embedding
    
    -- Drop existing constraint if it has a different name or to reset it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'items_uom_id_fkey' 
        AND table_name = 'items'
    ) THEN
        ALTER TABLE public.items DROP CONSTRAINT items_uom_id_fkey;
    END IF;

    -- Add the constraint with the specific name required by PostgREST embedding
    ALTER TABLE public.items
    ADD CONSTRAINT items_uom_id_fkey
    FOREIGN KEY (uom_id)
    REFERENCES public.uoms(id)
    ON DELETE RESTRICT;

    -- 2. Update RLS Policy to include Global UOMs (company_id IS NULL)
    
    -- Drop old policy
    DROP POLICY IF EXISTS uoms_isolation ON public.uoms;
    
    -- Create new policy
    CREATE POLICY uoms_isolation ON public.uoms
    FOR ALL
    USING (
        company_id IS NULL 
        OR 
        public.is_member_of(company_id)
    )
    WITH CHECK (
        public.is_member_of(company_id)
    );

END $$;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
