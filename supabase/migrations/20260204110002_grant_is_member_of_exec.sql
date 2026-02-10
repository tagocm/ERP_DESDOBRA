-- Grant execute on is_member_of for authenticated/anon roles

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'is_member_of'
    ) THEN
        GRANT EXECUTE ON FUNCTION public.is_member_of(UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.is_member_of(UUID) TO anon;
    END IF;
END $$;
