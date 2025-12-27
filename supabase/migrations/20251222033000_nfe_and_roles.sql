
-- Migration: NF-e Fields and Organization Roles
-- Adds fields required for Brazilian electronic invoicing (NF-e) and multi-role support

-- 1) Add NF-e fields to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS municipal_registration TEXT,
ADD COLUMN IF NOT EXISTS ie_indicator TEXT NOT NULL DEFAULT 'contributor' 
    CHECK (ie_indicator IN ('contributor', 'exempt', 'non_contributor')),
ADD COLUMN IF NOT EXISTS suframa TEXT,
ADD COLUMN IF NOT EXISTS email_nfe TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'BR';

-- Add comment for clarity
COMMENT ON COLUMN public.organizations.ie_indicator IS 'State registration indicator: contributor (requires IE), exempt (IE optional), non_contributor (no IE)';
COMMENT ON COLUMN public.organizations.email_nfe IS 'Email address for NF-e delivery';
COMMENT ON COLUMN public.organizations.suframa IS 'SUFRAMA registration for tax-free zone companies';

-- 2) Create organization_roles table for multi-role support
CREATE TABLE IF NOT EXISTS public.organization_roles (
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('prospect', 'customer', 'supplier', 'carrier', 'employee')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (company_id, organization_id, role)
);

-- Index for performance
CREATE INDEX idx_organization_roles_org ON public.organization_roles(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_organization_roles_company_role ON public.organization_roles(company_id, role) WHERE deleted_at IS NULL;

-- RLS for organization_roles
ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read access" ON public.organization_roles
    FOR SELECT TO authenticated 
    USING (is_member_of(company_id));

CREATE POLICY "Tenant write access" ON public.organization_roles
    FOR ALL TO authenticated 
    USING (is_member_of(company_id)) 
    WITH CHECK (is_member_of(company_id));

-- 3) Create CRM deals table (optional but recommended for sales pipeline)
CREATE TABLE IF NOT EXISTS public.crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    value DECIMAL(15,2),
    stage TEXT NOT NULL DEFAULT 'lead' 
        CHECK (stage IN ('lead', 'qualification', 'proposal', 'negotiation', 'won', 'lost')),
    source TEXT,
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    next_followup_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for CRM deals
CREATE INDEX idx_crm_deals_company ON public.crm_deals(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_deals_org ON public.crm_deals(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_deals_stage ON public.crm_deals(company_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_deals_owner ON public.crm_deals(owner_user_id) WHERE deleted_at IS NULL;

-- Trigger for CRM deals updated_at
CREATE TRIGGER update_crm_deals_updated_at
    BEFORE UPDATE ON public.crm_deals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for CRM deals
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read access" ON public.crm_deals
    FOR SELECT TO authenticated 
    USING (is_member_of(company_id));

CREATE POLICY "Tenant write access" ON public.crm_deals
    FOR ALL TO authenticated 
    USING (is_member_of(company_id)) 
    WITH CHECK (is_member_of(company_id));
