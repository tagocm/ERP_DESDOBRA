-- Ensure normalize_category_name works regardless of unaccent extension schema

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') THEN
    CREATE SCHEMA IF NOT EXISTS extensions;
    BEGIN
      ALTER EXTENSION unaccent SET SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      -- Keep current schema if we cannot move in this environment.
      NULL;
    END;    
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_category_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NULL THEN
    NEW.normalized_name := NULL;
    RETURN NEW;
  END IF;

  IF to_regprocedure('extensions.unaccent(text)') IS NOT NULL THEN
    NEW.normalized_name := lower(extensions.unaccent(btrim(NEW.name)));
  ELSIF to_regprocedure('public.unaccent(text)') IS NOT NULL THEN
    NEW.normalized_name := lower(public.unaccent(btrim(NEW.name)));
  ELSE
    NEW.normalized_name := lower(btrim(NEW.name));
  END IF;

  RETURN NEW;
END;
$$;
