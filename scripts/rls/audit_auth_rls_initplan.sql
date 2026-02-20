-- Audit: find policies still using auth.uid() without SELECT wrapper.

WITH raw AS (
  SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) AS expr
  FROM pg_policies
  WHERE schemaname = 'public'
),
stripped AS (
  SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    regexp_replace(
      expr,
      '\\(\\s*select\\s+auth\\.uid\\(\\)\\s*(as\\s+\\w+)?\\s*\\)',
      '',
      'gi'
    ) AS expr_without_wrapped_uid
  FROM raw
)
SELECT schemaname, tablename, policyname, cmd
FROM stripped
WHERE expr_without_wrapped_uid ~* 'auth\\.uid\\(\\)'
ORDER BY tablename, policyname;
