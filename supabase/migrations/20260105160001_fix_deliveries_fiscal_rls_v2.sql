-- Comprehensive Fix: Update helper function and RLS for Deliveries & Fiscal modules

BEGIN;

-- 1. Update/Create helper function to use 'company_members'
CREATE OR REPLACE FUNCTION public.is_member_of(_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = _company_id
    AND auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Fix Deliveries RLS (Use explicit subquery pattern for robustness, matching other tables)
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view deliveries for their company" ON public.deliveries;
DROP POLICY IF EXISTS "Users can insert deliveries for their company" ON public.deliveries;
DROP POLICY IF EXISTS "Users can update deliveries for their company" ON public.deliveries;
DROP POLICY IF EXISTS "Users can delete deliveries for their company" ON public.deliveries;

CREATE POLICY "Users can view deliveries for their company" ON public.deliveries
    FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert deliveries for their company" ON public.deliveries
    FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update deliveries for their company" ON public.deliveries
    FOR UPDATE USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete deliveries for their company" ON public.deliveries
    FOR DELETE USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));


-- 3. Fix Delivery Items RLS
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view delivery items for their company" ON public.delivery_items;
DROP POLICY IF EXISTS "Users can insert delivery items for their company" ON public.delivery_items;
DROP POLICY IF EXISTS "Users can update delivery items for their company" ON public.delivery_items;
DROP POLICY IF EXISTS "Users can delete delivery items for their company" ON public.delivery_items;

CREATE POLICY "Users can view delivery items for their company" ON public.delivery_items
    FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert delivery items for their company" ON public.delivery_items
    FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update delivery items for their company" ON public.delivery_items
    FOR UPDATE USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete delivery items for their company" ON public.delivery_items
    FOR DELETE USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));


-- 4. Fix Fiscal Operations RLS (Addressing the specific error in screenshot)
-- Check if table exists first to avoid error
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'fiscal_operations') THEN
        ALTER TABLE public.fiscal_operations ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Users can view fiscal ops" ON public.fiscal_operations;
        DROP POLICY IF EXISTS "Users can insert fiscal ops" ON public.fiscal_operations;
        DROP POLICY IF EXISTS "Users can update fiscal ops" ON public.fiscal_operations;
        
        -- Use company_id if it exists, otherwise assume linked to document?
        -- Standard assumption: fiscal_operations has company_id
        
        CREATE POLICY "Users can view fiscal ops" ON public.fiscal_operations
            FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

        CREATE POLICY "Users can insert fiscal ops" ON public.fiscal_operations
            FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));
            
        CREATE POLICY "Users can update fiscal ops" ON public.fiscal_operations
            FOR UPDATE USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));
    END IF;
END $$;


-- Force Schema Reload
NOTIFY pgrst, 'reload schema';

COMMIT;
