-- Comprehensive schema reload without verification
-- Just forces PostgREST to refresh all relationship metadata

-- Force PostgREST schema reload multiple times to ensure it takes
NOTIFY pgrst, 'reload schema';
SELECT pg_sleep(0.5);
NOTIFY pgrst, 'reload schema';
SELECT pg_sleep(0.5);
NOTIFY pgrst, 'reload schema';
