
DO $$
BEGIN
    -- CLEANUP: Delete orphaned roles first to allow FK creation
    DELETE FROM public.organization_roles
    WHERE organization_id NOT IN (SELECT id FROM public.organizations);

    -- Ensure FK exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_organization_roles_organization' 
        AND table_name = 'organization_roles'
    ) THEN
        -- Check if there is ANY FK to organizations (might be auto-named)
        -- If not, add one.
        -- Ideally we want a specific name.
        ALTER TABLE public.organization_roles
        ADD CONSTRAINT fk_organization_roles_organization
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations(id)
        ON DELETE CASCADE;
    END IF;

    -- Also check company FK
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_organization_roles_company' 
        AND table_name = 'organization_roles'
    ) THEN
        ALTER TABLE public.organization_roles
        ADD CONSTRAINT fk_organization_roles_company
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id)
        ON DELETE RESTRICT;
    END IF;

    -- Force reload
    NOTIFY pgrst, 'reload schema';
END $$;
