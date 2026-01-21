-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- GRANT permissions to authenticated and service_role
GRANT ALL ON organizations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations TO authenticated;

-- Drop existing policies likely to exist
DROP POLICY IF EXISTS "Organizations are viewable by company members" ON organizations;
DROP POLICY IF EXISTS "Organizations are insertable by company members" ON organizations;
DROP POLICY IF EXISTS "Organizations are updatable by company members" ON organizations;
DROP POLICY IF EXISTS "Organizations are deletable by company members" ON organizations;

-- Also drop potential other naming conventions
DROP POLICY IF EXISTS "Select organizations" ON organizations;
DROP POLICY IF EXISTS "Insert organizations" ON organizations;
DROP POLICY IF EXISTS "Update organizations" ON organizations;
DROP POLICY IF EXISTS "Delete organizations" ON organizations;
DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON organizations;

-- Create Policies

-- SELECT
CREATE POLICY "Organizations are viewable by company members" 
ON organizations FOR SELECT 
TO authenticated
USING (
    company_id IN (
        SELECT company_id 
        FROM company_members 
        WHERE auth_user_id = auth.uid()
    )
);

-- INSERT
CREATE POLICY "Organizations are insertable by company members" 
ON organizations FOR INSERT 
TO authenticated
WITH CHECK (
    company_id IN (
        SELECT company_id 
        FROM company_members 
        WHERE auth_user_id = auth.uid()
    )
);

-- UPDATE
CREATE POLICY "Organizations are updatable by company members" 
ON organizations FOR UPDATE 
TO authenticated
USING (
    company_id IN (
        SELECT company_id 
        FROM company_members 
        WHERE auth_user_id = auth.uid()
    )
);

-- DELETE
CREATE POLICY "Organizations are deletable by company members" 
ON organizations FOR DELETE 
TO authenticated
USING (
    company_id IN (
        SELECT company_id 
        FROM company_members 
        WHERE auth_user_id = auth.uid()
    )
);
