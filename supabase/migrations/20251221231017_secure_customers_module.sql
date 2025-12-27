
-- 1) Drop all permissive policies across the board
DROP POLICY IF EXISTS "Enable all for devs" ON public.organizations;
DROP POLICY IF EXISTS "Enable all for devs" ON public.people;
DROP POLICY IF EXISTS "Enable all for devs" ON public.addresses;
DROP POLICY IF EXISTS "Enable all for devs" ON public.organization_tags;
DROP POLICY IF EXISTS "Enable all for devs" ON public.organization_tag_links;

-- Also cleanup companies/users just in case they were re-added or persisted
DROP POLICY IF EXISTS "Enable all for devs" ON public.companies;
DROP POLICY IF EXISTS "Enable read for all users" ON public.companies;
DROP POLICY IF EXISTS "Enable all for devs" ON public.users;
DROP POLICY IF EXISTS "Enable read for all users" ON public.users;

-- 2) READ-ONLY Policies (Select only for authenticated users)
CREATE POLICY "allow_read_auth_only" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_read_auth_only" ON public.people FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_read_auth_only" ON public.addresses FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_read_auth_only" ON public.organization_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_read_auth_only" ON public.organization_tag_links FOR SELECT TO authenticated USING (true);


-- 3) Enforce NOT NULL on timestamps (Consistency)
ALTER TABLE public.organizations ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.organizations ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.people ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.people ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.addresses ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.addresses ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.organization_tags ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.organization_tags ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.organization_tag_links ALTER COLUMN created_at SET NOT NULL;

-- (Already done for companies/users in previous migration, but safe to repeat if idempotent, 
--  however, 'ALTER COLUMN SET NOT NULL' does not error if already set, but let's assume previous migration ran).


-- 4) Soft-Delete Aware Uniqueness

-- Organizations Document (Remove old index, create new partial one)
DROP INDEX IF EXISTS idx_organizations_company_document;
CREATE UNIQUE INDEX idx_organizations_company_document
    ON public.organizations(company_id, document)
    WHERE document IS NOT NULL AND deleted_at IS NULL;

-- Organization Tags (Remove table constraint if exists, use partial index)
-- Note: We don't know the exact constraint name if it was created via UNIQUE(..).
-- Usually it is "organization_tags_company_id_name_key". We try to drop it.
ALTER TABLE public.organization_tags DROP CONSTRAINT IF EXISTS organization_tags_company_id_name_key;

CREATE UNIQUE INDEX idx_org_tags_company_name
    ON public.organization_tags(company_id, name)
    WHERE deleted_at IS NULL;


-- 5) Business Logic Constraints (One Primary/Default per Scope)

-- Single Primary Contact per Organization (ignoring deleted)
CREATE UNIQUE INDEX idx_people_one_primary_per_org
    ON public.people(company_id, organization_id)
    WHERE is_primary IS TRUE AND deleted_at IS NULL;

-- Single Default Address per Org AND Type (ignoring deleted)
CREATE UNIQUE INDEX idx_addresses_one_default_per_org_type
    ON public.addresses(company_id, organization_id, type)
    WHERE is_default IS TRUE AND deleted_at IS NULL;


-- 6) Performance Indexes
CREATE INDEX idx_tag_links_org ON public.organization_tag_links(organization_id);
CREATE INDEX idx_tag_links_tag ON public.organization_tag_links(tag_id);
