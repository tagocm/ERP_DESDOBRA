-- Migration: Add 'representative' role to organization_roles 
-- And update sales_rep foreign keys to reference organizations instead of users

-- 1. Update the check constraint for organization_roles
ALTER TABLE public.organization_roles
    DROP CONSTRAINT IF EXISTS organization_roles_role_check;

ALTER TABLE public.organization_roles
    ADD CONSTRAINT organization_roles_role_check
    CHECK (role IN ('prospect', 'customer', 'supplier', 'carrier', 'employee', 'representative'));

-- 2. Update organizations.sales_rep_user_id foreign key
-- This column was pointing to auth.users, but representatives are now Organizations
ALTER TABLE public.organizations
    DROP CONSTRAINT IF EXISTS organizations_sales_rep_user_id_fkey;

ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_sales_rep_user_id_fkey
    FOREIGN KEY (sales_rep_user_id)
    REFERENCES public.organizations(id)
    NOT VALID;

-- 3. Update sales_documents.sales_rep_id foreign key
-- Assuming sales_documents table exists and has this column
ALTER TABLE public.sales_documents
    DROP CONSTRAINT IF EXISTS sales_documents_sales_rep_id_fkey;

-- Note: In some versions it might be sales_rep_user_id in sales_documents too. 
-- Based on previous knowledge it's sales_rep_id.
ALTER TABLE public.sales_documents
    ADD CONSTRAINT sales_documents_sales_rep_id_fkey
    FOREIGN KEY (sales_rep_id)
    REFERENCES public.organizations(id)
    NOT VALID;
