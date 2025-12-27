
-- 1) COMPANY MEMBERS (Mapeia auth.users -> companies)
CREATE TABLE public.company_members (
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'sales', 'finance', 'logistics')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, auth_user_id)
);

-- Index for fast lookup by user
CREATE INDEX idx_company_members_user ON public.company_members(auth_user_id);
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Member policies
-- Self-read: Users can see which companies they belong to
CREATE POLICY "Users can see memberships" ON public.company_members
    FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid());


-- 2) USER PROFILES (Opcional - armazena dados extras do auth.user)
CREATE TABLE public.user_profiles (
    auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());


-- 3) RE-APPLY RLS WITH MULTI-TENANT CHECKS

-- Helper function to check if current user is member of a company
CREATE OR REPLACE FUNCTION public.is_member_of(_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.company_members 
    WHERE company_id = _company_id 
      AND auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- A) COMPANIES
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.companies;
DROP POLICY IF EXISTS "Enable read for all users" ON public.companies;
DROP POLICY IF EXISTS "Enable all for devs" ON public.companies;

CREATE POLICY "Users see companies they are member of" ON public.companies
    FOR SELECT TO authenticated
    USING (is_member_of(id));

-- B) CUSTOMERS MODULE (Organizations, People, Addresses, Tags)
-- Drop old permissive policies
DROP POLICY IF EXISTS "allow_read_auth_only" ON public.organizations;
DROP POLICY IF EXISTS "allow_read_auth_only" ON public.people;
DROP POLICY IF EXISTS "allow_read_auth_only" ON public.addresses;
DROP POLICY IF EXISTS "allow_read_auth_only" ON public.organization_tags;
DROP POLICY IF EXISTS "allow_read_auth_only" ON public.organization_tag_links;

-- Organizations
CREATE POLICY "Tenant read access" ON public.organizations
    FOR SELECT TO authenticated USING (is_member_of(company_id));
CREATE POLICY "Tenant write access" ON public.organizations
    FOR ALL TO authenticated USING (is_member_of(company_id)) WITH CHECK (is_member_of(company_id));

-- People
CREATE POLICY "Tenant read access" ON public.people
    FOR SELECT TO authenticated USING (is_member_of(company_id));
CREATE POLICY "Tenant write access" ON public.people
    FOR ALL TO authenticated USING (is_member_of(company_id)) WITH CHECK (is_member_of(company_id));

-- Addresses
CREATE POLICY "Tenant read access" ON public.addresses
    FOR SELECT TO authenticated USING (is_member_of(company_id));
CREATE POLICY "Tenant write access" ON public.addresses
    FOR ALL TO authenticated USING (is_member_of(company_id)) WITH CHECK (is_member_of(company_id));

-- Tags
CREATE POLICY "Tenant read access" ON public.organization_tags
    FOR SELECT TO authenticated USING (is_member_of(company_id));
CREATE POLICY "Tenant write access" ON public.organization_tags
    FOR ALL TO authenticated USING (is_member_of(company_id)) WITH CHECK (is_member_of(company_id));

-- Tag Links
CREATE POLICY "Tenant read access" ON public.organization_tag_links
    FOR SELECT TO authenticated USING (is_member_of(company_id));
CREATE POLICY "Tenant write access" ON public.organization_tag_links
    FOR ALL TO authenticated USING (is_member_of(company_id)) WITH CHECK (is_member_of(company_id));
