
BEGIN;

-- Ensure RLS is enabled on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Drop existing overlapping policies if any (safeguard)
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
DROP POLICY IF EXISTS "Users can view associated company" ON public.companies;

-- Create policy allowing members to view their company
CREATE POLICY "Users can view associated company" ON public.companies
    FOR SELECT USING (
        id IN (
            SELECT company_id 
            FROM public.company_members 
            WHERE auth_user_id = auth.uid()
        )
    );

COMMIT;
