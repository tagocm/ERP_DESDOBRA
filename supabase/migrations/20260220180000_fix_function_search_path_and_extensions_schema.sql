-- Fix Supabase linter:
-- - 0011_function_search_path_mutable
-- - 0014_extension_in_public

-- 1) Harden search_path for user-defined functions in public schema.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path TO public, pg_catalog',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

-- 2) Move extensions out of public schema.
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'ALTER EXTENSION pg_trgm SET SCHEMA extensions';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') THEN
    EXECUTE 'ALTER EXTENSION unaccent SET SCHEMA extensions';
  END IF;
END
$$;
