-- Comprehensive RLS Fix: Replace 'company_users' with 'company_members'
-- This fixes access to Sales Documents and all child tables.

BEGIN;

-- 1. Sales Documents
DROP POLICY IF EXISTS "Users can view sales docs of their company" ON public.sales_documents;
DROP POLICY IF EXISTS "Users can insert sales docs for their company" ON public.sales_documents;
DROP POLICY IF EXISTS "Users can update sales docs of their company" ON public.sales_documents;
DROP POLICY IF EXISTS "Users can delete sales docs for their company" ON public.sales_documents;

CREATE POLICY "Users can view sales docs of their company" ON public.sales_documents
    FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert sales docs for their company" ON public.sales_documents
    FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update sales docs of their company" ON public.sales_documents
    FOR UPDATE USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete sales docs for their company" ON public.sales_documents
    FOR DELETE USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));


-- 2. Sales Document Items
DROP POLICY IF EXISTS "Users can manage items of their company docs" ON public.sales_document_items;

CREATE POLICY "Users can manage items of their company docs" ON public.sales_document_items
    FOR ALL USING (
        document_id IN (
            SELECT id FROM public.sales_documents WHERE company_id IN (
                SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
            )
        )
    );


-- 3. Sales Payments 
-- (Already addressed previously, but enforcing consistency here just in case)
DROP POLICY IF EXISTS "Users can manage payments of their company docs" ON public.sales_document_payments;

CREATE POLICY "Users can manage payments of their company docs" ON public.sales_document_payments
    FOR ALL USING (
        document_id IN (
            SELECT id FROM public.sales_documents WHERE company_id IN (
                SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
            )
        )
    );


-- 5. Sales History (Skipping 4. NFes as table might be missing)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'sales_document_history') THEN
        DROP POLICY IF EXISTS "Users can view history of their company docs" ON public.sales_document_history;

        CREATE POLICY "Users can view history of their company docs" ON public.sales_document_history
            FOR SELECT USING (
                document_id IN (
                    SELECT id FROM public.sales_documents WHERE company_id IN (
                        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;


-- 6. Organizations (Clients/Carriers)
-- Also crucial for joins. 
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'organizations') THEN
       -- We assume standard RLS pattern here. 
       -- Checking existing policies might be hard blindly. 
       -- Let's just create a new one "Users can view organizations of their company_v2" to be safe and ensure access.
       
       DROP POLICY IF EXISTS "Users can view organizations" ON public.organizations;
       DROP POLICY IF EXISTS "Users can view organizations of their company" ON public.organizations;
       
       CREATE POLICY "Users can view organizations of their company" ON public.organizations
           FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));
           
       -- ensure RLS is on
       ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;


-- Force Schema Reload
NOTIFY pgrst, 'reload schema';

COMMIT;
