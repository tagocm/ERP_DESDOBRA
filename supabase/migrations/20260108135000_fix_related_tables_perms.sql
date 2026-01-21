-- Enable RLS for all related tables
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- GRANT permissions (Crucial for 403 fix)
GRANT ALL ON addresses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON addresses TO authenticated;

GRANT ALL ON people TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON people TO authenticated;

GRANT ALL ON organization_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_roles TO authenticated;

GRANT ALL ON organization_branches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_branches TO authenticated;

GRANT ALL ON company_members TO service_role;
GRANT SELECT ON company_members TO authenticated; -- Users need to read membership to verify access

-- APPLY RLS POLICIES

-- ADDRESSES
DROP POLICY IF EXISTS "Addresses viewable by company" ON addresses;
DROP POLICY IF EXISTS "Addresses insertable by company" ON addresses;
DROP POLICY IF EXISTS "Addresses updatable by company" ON addresses;
DROP POLICY IF EXISTS "Addresses deletable by company" ON addresses;

CREATE POLICY "Addresses viewable by company" ON addresses FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "Addresses insertable by company" ON addresses FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "Addresses updatable by company" ON addresses FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "Addresses deletable by company" ON addresses FOR DELETE TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));

-- PEOPLE
DROP POLICY IF EXISTS "People viewable by company" ON people;
DROP POLICY IF EXISTS "People insertable by company" ON people;
DROP POLICY IF EXISTS "People updatable by company" ON people;
DROP POLICY IF EXISTS "People deletable by company" ON people;

CREATE POLICY "People viewable by company" ON people FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "People insertable by company" ON people FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "People updatable by company" ON people FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "People deletable by company" ON people FOR DELETE TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));

-- ORGANIZATION_ROLES
DROP POLICY IF EXISTS "Org Roles viewable by company" ON organization_roles;
DROP POLICY IF EXISTS "Org Roles insertable by company" ON organization_roles;
DROP POLICY IF EXISTS "Org Roles updatable by company" ON organization_roles;
DROP POLICY IF EXISTS "Org Roles deletable by company" ON organization_roles;

CREATE POLICY "Org Roles viewable by company" ON organization_roles FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "Org Roles insertable by company" ON organization_roles FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "Org Roles updatable by company" ON organization_roles FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "Org Roles deletable by company" ON organization_roles FOR DELETE TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));

-- ORGANIZATION_BRANCHES
DROP POLICY IF EXISTS "Branches viewable by company" ON organization_branches;
DROP POLICY IF EXISTS "Branches insertable by company" ON organization_branches;
DROP POLICY IF EXISTS "Branches updatable by company" ON organization_branches;
DROP POLICY IF EXISTS "Branches deletable by company" ON organization_branches;

CREATE POLICY "Branches viewable by company" ON organization_branches FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "Branches insertable by company" ON organization_branches FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "Branches updatable by company" ON organization_branches FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
CREATE POLICY "Branches deletable by company" ON organization_branches FOR DELETE TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));

-- COMPANY_MEMBERS (Read-only for authenticated users generally, unless admin)
DROP POLICY IF EXISTS "Members viewable by company" ON company_members;
CREATE POLICY "Members viewable by company" ON company_members FOR SELECT TO authenticated USING (auth_user_id = auth.uid()); -- Can view own membership
-- Or allow viewing all members of same company
-- CREATE POLICY "Members viewable by company" ON company_members FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM company_members cm2 WHERE cm2.auth_user_id = auth.uid()));
