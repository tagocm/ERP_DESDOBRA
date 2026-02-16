
-- A) ORGANIZATIONS: Document Refinement
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS document_type TEXT CHECK (document_type IN ('cpf', 'cnpj', 'other')),
ADD COLUMN IF NOT EXISTS document_number TEXT; -- Stores only digits

-- NOTE: Foundation migration (20251221224000) already creates document_number.
-- No data migration needed from legacy 'document' column as it never existed in this migration path.


-- Create Unique Partial Index for new document structure
CREATE UNIQUE INDEX idx_organizations_doc_type_number 
ON public.organizations(company_id, document_type, document_number) 
WHERE deleted_at IS NULL AND document_number IS NOT NULL;


-- B) ORGANIZATION BRANCHES (Filiais)
CREATE TABLE IF NOT EXISTS public.organization_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    default_payment_terms_days INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Triggers (updated_at)
CREATE TRIGGER update_organization_branches_updated_at
BEFORE UPDATE ON public.organization_branches
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for Branches
CREATE INDEX idx_branches_company_org ON public.organization_branches(company_id, organization_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_branches_unique_name ON public.organization_branches(company_id, organization_id, name) WHERE deleted_at IS NULL;

-- RLS for Branches
ALTER TABLE public.organization_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read access" ON public.organization_branches
    FOR SELECT TO authenticated USING (is_member_of(company_id));

CREATE POLICY "Tenant write access" ON public.organization_branches
    FOR ALL TO authenticated USING (is_member_of(company_id)) WITH CHECK (is_member_of(company_id));


-- C) ADDRESSES: Link to Branch
ALTER TABLE public.addresses 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.organization_branches(id) ON DELETE SET NULL;

-- Index for addresses by branch
CREATE INDEX idx_addresses_branch ON public.addresses(company_id, branch_id) WHERE deleted_at IS NULL;

-- Unique Default Logic: Per Branch + Type (if branch exists)
-- Note: existing unique index was on (company_id, organization_id, type).
-- We need to adjust it or add a new one.
-- A default address usually belongs to a specific entity level.
-- If an address is linked to a branch, it can be the default for that branch.

CREATE UNIQUE INDEX idx_addresses_default_per_branch_type
ON public.addresses(company_id, branch_id, type)
WHERE is_default IS TRUE AND deleted_at IS NULL AND branch_id IS NOT NULL;


-- D) PEOPLE: Link to Branch + Notes
ALTER TABLE public.people 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.organization_branches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index for people by branch
CREATE INDEX idx_people_branch ON public.people(company_id, branch_id) WHERE deleted_at IS NULL;

-- Unique Primary Contact per Branch
CREATE UNIQUE INDEX idx_people_primary_per_branch
ON public.people(company_id, branch_id)
WHERE is_primary IS TRUE AND deleted_at IS NULL AND branch_id IS NOT NULL;

-- (The existing index idx_people_one_primary_per_org handles the case where branch_id is NULL or ignored,
-- depending on business logic. If we want strictly one primary for the ROOT org vs one for BRANCH, we keep both.)
-- Let's ensure the old index logic still holds for org-wide contacts if branch_id is null:
DROP INDEX IF EXISTS idx_people_one_primary_per_org;
CREATE UNIQUE INDEX idx_people_primary_per_org_root
ON public.people(company_id, organization_id)
WHERE is_primary IS TRUE AND deleted_at IS NULL AND branch_id IS NULL;


-- Refine constraints/indexes for previous columns if needed
-- (Already handled by previous migrations)
