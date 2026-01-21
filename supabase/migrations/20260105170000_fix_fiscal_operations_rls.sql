-- Migration: Fix RLS Policies for Fiscal Operations
-- Description: Standardizes RLS policies to use the 'is_member_of' helper function, consistent with other tables.

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view fiscal operations from their company" ON public.fiscal_operations;
DROP POLICY IF EXISTS "Users can insert fiscal operations for their company" ON public.fiscal_operations;
DROP POLICY IF EXISTS "Users can update fiscal operations for their company" ON public.fiscal_operations;
DROP POLICY IF EXISTS "Users can delete (soft) fiscal operations for their company" ON public.fiscal_operations;

-- Recreate policies using standardized helper
CREATE POLICY "Users can view fiscal operations from their company"
    ON public.fiscal_operations FOR SELECT
    USING (public.is_member_of(company_id));

CREATE POLICY "Users can insert fiscal operations for their company"
    ON public.fiscal_operations FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Users can update fiscal operations for their company"
    ON public.fiscal_operations FOR UPDATE
    USING (public.is_member_of(company_id));

CREATE POLICY "Users can delete (soft) fiscal operations for their company"
    ON public.fiscal_operations FOR DELETE
    USING (public.is_member_of(company_id));

-- Force schema reload
NOTIFY pgrst, 'reload schema';
