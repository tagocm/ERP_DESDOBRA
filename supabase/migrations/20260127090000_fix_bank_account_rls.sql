-- Fix RLS for Bank Accounts using Security Definer
-- This bypasses the recursion/visibility issues on company_members

-- 1. Helper Function: Check permissions securely
CREATE OR REPLACE FUNCTION public.has_company_role(_company_id UUID, _required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  -- Security Definer allows this function to read company_members 
  -- even if the calling user cannot see the table directly via RLS
  RETURN EXISTS (
    SELECT 1 
    FROM public.company_members 
    WHERE company_id = _company_id 
      AND auth_user_id = auth.uid()
      AND role = ANY(_required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.has_company_role TO authenticated;


-- 2. Update Policies on company_bank_accounts

-- Drop existing (ensure clean slate)
DROP POLICY IF EXISTS "Tenant read bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Tenant write bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Tenant insert bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Tenant update bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Tenant delete bank accounts" ON public.company_bank_accounts;

-- Re-create Read Policy (All members can read)
CREATE POLICY "Tenant read bank accounts" ON public.company_bank_accounts
    FOR SELECT TO authenticated
    USING (public.has_company_role(company_id, ARRAY['owner', 'admin', 'sales', 'finance', 'logistics']));

-- Re-create Write Policy (Only Admin/Owner/Finance)
-- Using 'finance' role as well since it makes sense
CREATE POLICY "Tenant write bank accounts" ON public.company_bank_accounts
    FOR ALL TO authenticated
    USING (public.has_company_role(company_id, ARRAY['owner', 'admin', 'finance']))
    WITH CHECK (public.has_company_role(company_id, ARRAY['owner', 'admin', 'finance']));

-- Explicit Insert Policy (Redundant if 'ALL' is used, but good for clarity if needed. 'ALL' covers it)
