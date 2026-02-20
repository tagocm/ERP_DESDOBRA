-- Audit: detect effective duplicate PERMISSIVE policies per (schema, table, cmd, role)
-- considering that policies TO public apply to every role.

WITH target_roles AS (
    SELECT rolname
    FROM pg_roles
    WHERE rolcanlogin
      AND rolname NOT LIKE 'pg_%'
),
expanded AS (
    SELECT
        p.schemaname,
        p.tablename,
        p.cmd,
        r.rolname AS role_name,
        p.policyname,
        p.permissive
    FROM pg_policies p
    JOIN target_roles r
      ON r.rolname = ANY (p.roles)
      OR 'public' = ANY (p.roles)
    WHERE p.schemaname = 'public'
)
SELECT
    schemaname,
    tablename,
    cmd,
    role_name,
    COUNT(*) AS permissive_count,
    ARRAY_AGG(policyname ORDER BY policyname) AS policies
FROM expanded
WHERE permissive = 'PERMISSIVE'
GROUP BY schemaname, tablename, cmd, role_name
HAVING COUNT(*) > 1
ORDER BY schemaname, tablename, cmd, role_name;
