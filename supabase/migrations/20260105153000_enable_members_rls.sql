-- Ensure company_members is visible to users themselves
-- Crucial for the recursive queries in other policies to work

BEGIN;

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own membership" ON public.company_members;

CREATE POLICY "Users can view their own membership"
    ON public.company_members
    FOR SELECT
    USING (auth_user_id = auth.uid());

-- Force Reload
NOTIFY pgrst, 'reload schema';

COMMIT;
