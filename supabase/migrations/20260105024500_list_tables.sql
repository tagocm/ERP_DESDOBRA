-- List all tables in public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename) LOOP
        RAISE NOTICE 'Table: %', r.tablename;
    END LOOP;
END $$;
