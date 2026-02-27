-- Widen SEFAZ status code columns.
--
-- Context:
-- SEFAZ can return 4-digit rejection codes (e.g. 1002), but some tables were created with
-- `c_stat varchar(3)`, causing runtime failures when persisting emissions/cancellations/CC-e.
--
-- Safe/idempotent:
-- - Uses ALTER COLUMN TYPE with USING cast (no data loss)
-- - Wraps optional tables in exception guards
-- - Notifies PostgREST to reload schema

BEGIN;

-- nfe_emissions.c_stat: was varchar(3) in early migrations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nfe_emissions'
      AND column_name = 'c_stat'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE public.nfe_emissions
      ALTER COLUMN c_stat TYPE text
      USING c_stat::text;
  END IF;
END $$;

-- nfe_cancellations.c_stat: may exist depending on environment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nfe_cancellations'
      AND column_name = 'c_stat'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE public.nfe_cancellations
      ALTER COLUMN c_stat TYPE text
      USING c_stat::text;
  END IF;
END $$;

-- nfe_correction_letters.c_stat: may exist depending on environment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nfe_correction_letters'
      AND column_name = 'c_stat'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE public.nfe_correction_letters
      ALTER COLUMN c_stat TYPE text
      USING c_stat::text;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

