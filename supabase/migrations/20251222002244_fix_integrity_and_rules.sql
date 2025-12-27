
-- 1) STRICT INTEGRITY FOR BRANCHES
-- Ensure that when a person or address is linked to a branch, 
-- they are also linked to the SAME company and organization as that branch.

-- First, enforce uniqueness on the composite key in organization_branches
-- This is required to be the target of a foreign key
ALTER TABLE public.organization_branches
    ADD CONSTRAINT organization_branches_integrity_key 
    UNIQUE (id, company_id, organization_id);

-- Update PEOPLE table to use composite foreign key
-- We keep the columns, but add a strict constraint.
ALTER TABLE public.people
    ADD CONSTRAINT people_branch_integrity_fkey 
    FOREIGN KEY (branch_id, company_id, organization_id) 
    REFERENCES public.organization_branches (id, company_id, organization_id) 
    ON DELETE SET NULL; -- If branch is deleted, contact unlinks from branch but stays in company/org

-- Update ADDRESSES table to use composite foreign key
ALTER TABLE public.addresses
    ADD CONSTRAINT addresses_branch_integrity_fkey 
    FOREIGN KEY (branch_id, company_id, organization_id) 
    REFERENCES public.organization_branches (id, company_id, organization_id) 
    ON DELETE SET NULL;


-- 2) DOCUMENTS: Normalization and Type Inference
create or replace function public.normalize_and_infer_document()
returns trigger as $$
begin
  -- Strip non-digits from document_number
  NEW.document_number := regexp_replace(NEW.document_number, '\D', '', 'g');

  -- Infer type based on length if document_number is present
  IF NEW.document_number IS NOT NULL AND length(NEW.document_number) > 0 THEN
      IF length(NEW.document_number) = 11 THEN
          NEW.document_type := 'cpf';
      ELSIF length(NEW.document_number) = 14 THEN
          NEW.document_type := 'cnpj';
      ELSE
          NEW.document_type := 'other';
      END IF;
  END IF;

  RETURN NEW;
end;
$$ language plpgsql;

create trigger trg_normalize_document
before insert or update on public.organizations
for each row execute function public.normalize_and_infer_document();

-- Unique Partial Index for Documents
-- (Replacing previous one if it exists or creating new robust one)
DROP INDEX IF EXISTS idx_organizations_doc_type_number; -- Drop if exists from previous manual attempts or partial migrations
CREATE UNIQUE INDEX idx_organizations_doc_unique 
ON public.organizations(company_id, document_type, document_number) 
WHERE deleted_at IS NULL AND document_number IS NOT NULL;


-- 3) BUSINESS RULES: One Primary / One Default

-- PEOPLE: One Primary per Organization (Root) OR per Branch
-- Drop conflicting indexes from previous migrations if they exist
DROP INDEX IF EXISTS idx_people_one_primary_per_org;
DROP INDEX IF EXISTS idx_people_primary_per_branch;
DROP INDEX IF EXISTS idx_people_primary_per_org_root;

-- Re-create stricter indexes
-- A. Primary for Branch
CREATE UNIQUE INDEX idx_people_primary_per_branch 
ON public.people(company_id, branch_id) 
WHERE is_primary IS TRUE AND deleted_at IS NULL AND branch_id IS NOT NULL;

-- B. Primary for Organization (when no branch is assigned)
CREATE UNIQUE INDEX idx_people_primary_per_org_root 
ON public.people(company_id, organization_id) 
WHERE is_primary IS TRUE AND deleted_at IS NULL AND branch_id IS NULL;


-- ADDRESSES: One Default per Type per Branch OR per Organization
DROP INDEX IF EXISTS idx_addresses_one_default_per_org_type;
DROP INDEX IF EXISTS idx_addresses_default_per_branch_type;

-- A. Default for Branch + Type
CREATE UNIQUE INDEX idx_addresses_default_branch 
ON public.addresses(company_id, branch_id, type) 
WHERE is_default IS TRUE AND deleted_at IS NULL AND branch_id IS NOT NULL;

-- B. Default for Organization + Type (Root)
CREATE UNIQUE INDEX idx_addresses_default_org 
ON public.addresses(company_id, organization_id, type) 
WHERE is_default IS TRUE AND deleted_at IS NULL AND branch_id IS NULL;


-- 4) PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_company_members_auth_user_id ON public.company_members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_org_tag_links_org ON public.organization_tag_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_tag_links_tag ON public.organization_tag_links(tag_id);
