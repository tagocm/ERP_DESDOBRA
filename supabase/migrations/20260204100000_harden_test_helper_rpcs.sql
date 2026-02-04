-- Harden test helper RPCs
-- These RPCs are useful for local/dev automation, but MUST NOT be callable by anon/authenticated.

-- get_test_user_id()
REVOKE ALL ON FUNCTION public.get_test_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_test_user_id() FROM anon;
REVOKE ALL ON FUNCTION public.get_test_user_id() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_test_user_id() TO service_role;

-- seed_test_data()
REVOKE ALL ON FUNCTION public.seed_test_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_test_data() FROM anon;
REVOKE ALL ON FUNCTION public.seed_test_data() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seed_test_data() TO service_role;

