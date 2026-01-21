-- Ensure explicit foreign key name for bom_byproduct_outputs -> items
-- This fixes the PostgREST error when using explicit hint !bom_byproduct_outputs_item_id_fkey

DO $$
BEGIN
    -- Drop existing constraint if it exists (generic name possibly)
    ALTER TABLE public.bom_byproduct_outputs 
    DROP CONSTRAINT IF EXISTS bom_byproduct_outputs_item_id_fkey;

    -- Re-add with explicit name
    ALTER TABLE public.bom_byproduct_outputs
    ADD CONSTRAINT bom_byproduct_outputs_item_id_fkey
    FOREIGN KEY (item_id)
    REFERENCES public.items(id)
    ON DELETE RESTRICT;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Constraint already exists or error: %', SQLERRM;
END $$;
