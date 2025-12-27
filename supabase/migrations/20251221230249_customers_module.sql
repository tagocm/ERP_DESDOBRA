
-- 1) ORGANIZATIONS (Clients)
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    legal_name TEXT,
    trade_name TEXT NOT NULL,
    document TEXT,
    state_registration TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    default_payment_terms_days INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for Organizations
CREATE INDEX idx_organizations_company_trade_name ON public.organizations(company_id, trade_name);
CREATE UNIQUE INDEX idx_organizations_company_document ON public.organizations(company_id, document) WHERE document IS NOT NULL;
CREATE INDEX idx_organizations_deleted_at ON public.organizations(deleted_at);

-- Trigger for Organizations updated_at
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();


-- 2) PEOPLE (Contacts)
CREATE TABLE public.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role_title TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for People
CREATE INDEX idx_people_company_org ON public.people(company_id, organization_id);
CREATE INDEX idx_people_company_email ON public.people(company_id, email);
CREATE INDEX idx_people_deleted_at ON public.people(deleted_at);

-- Trigger for People updated_at
CREATE TRIGGER update_people_updated_at
    BEFORE UPDATE ON public.people
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();


-- 3) ADDRESSES
CREATE TABLE public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'shipping' CHECK (type IN ('shipping', 'billing', 'other')),
    label TEXT,
    zip TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    country TEXT NOT NULL DEFAULT 'BR',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for Addresses
CREATE INDEX idx_addresses_company_org_type ON public.addresses(company_id, organization_id, type);
CREATE INDEX idx_addresses_deleted_at ON public.addresses(deleted_at);

-- Trigger for Addresses updated_at
CREATE TRIGGER update_addresses_updated_at
    BEFORE UPDATE ON public.addresses
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();


-- 4) ORGANIZATION TAGS
CREATE TABLE public.organization_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(company_id, name)
);

-- Trigger for Tags updated_at
CREATE TRIGGER update_organization_tags_updated_at
    BEFORE UPDATE ON public.organization_tags
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();


-- 5) ORGANIZATION TAG LINKS (N:N)
CREATE TABLE public.organization_tag_links (
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.organization_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (company_id, organization_id, tag_id)
);


-- RLS Policies (Simple Enable All for Dev - matching previous pattern)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_tag_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for devs" ON public.organizations FOR ALL USING (true);
CREATE POLICY "Enable all for devs" ON public.people FOR ALL USING (true);
CREATE POLICY "Enable all for devs" ON public.addresses FOR ALL USING (true);
CREATE POLICY "Enable all for devs" ON public.organization_tags FOR ALL USING (true);
CREATE POLICY "Enable all for devs" ON public.organization_tag_links FOR ALL USING (true);
