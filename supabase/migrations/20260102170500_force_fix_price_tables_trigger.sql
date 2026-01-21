-- Force Migration to remove invalid triggers from price_tables
-- Previous migration 20260102170000 might have been skipped or failed silently.
-- We must ensure any trigger on price_tables that accesses unknown columns is dropped.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'public.price_tables'::regclass
        AND tgname != 'handle_updated_at'
        AND tgisinternal = false
    LOOP
        EXECUTE 'DROP TRIGGER ' || quote_ident(r.tgname) || ' ON public.price_tables';
        RAISE NOTICE 'Dropped trigger % on price_tables', r.tgname;
    END LOOP;
END $$;
