-- Fix creator relationship for inventory_movements
-- Add FK to public.user_profiles to enable PostgREST embedding

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inventory_movements_creator_profile') THEN
        ALTER TABLE public.inventory_movements
        ADD CONSTRAINT fk_inventory_movements_creator_profile
        FOREIGN KEY (created_by)
        REFERENCES public.user_profiles(auth_user_id);
    END IF;
END $$;
