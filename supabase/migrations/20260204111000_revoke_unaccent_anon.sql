-- Revoke anon/public EXECUTE on unaccent functions (extension-owned).
-- NOTE: Requires owner privileges (supabase_admin). May fail if run without it.
REVOKE EXECUTE ON FUNCTION public.unaccent(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unaccent(regdictionary, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unaccent_init(internal) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unaccent_lexize(internal, internal, internal, internal) FROM PUBLIC, anon;
