-- Migration to remove invalid triggers from price_tables
-- The function format_text_fields references NEW.description, which does not exist on price_tables.
-- This causes "record "new" has no field "description"" error.
-- We must drop any trigger on price_tables that uses this function.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'public.price_tables'::regclass
        AND tgname != 'handle_updated_at'
    LOOP
        EXECUTE 'DROP TRIGGER ' || quote_ident(r.tgname) || ' ON public.price_tables';
        RAISE NOTICE 'Dropped trigger % on price_tables', r.tgname;
    END LOOP;
END $$;
