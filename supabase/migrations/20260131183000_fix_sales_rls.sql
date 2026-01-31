-- Fix: Update RLS policies to use 'company_members' instead of non-existent 'company_users'
-- Error: 500 Internal Server Error (Relation "public.company_users" does not exist)

BEGIN;

-- 1. Sales Documents
DROP POLICY IF EXISTS "Users can view sales docs of their company" ON public.sales_documents;
DROP POLICY IF EXISTS "Users can insert sales docs for their company" ON public.sales_documents;
DROP POLICY IF EXISTS "Users can update sales docs of their company" ON public.sales_documents;

CREATE POLICY "Users can view sales docs of their company" ON public.sales_documents
    FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert sales docs for their company" ON public.sales_documents
    FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update sales docs of their company" ON public.sales_documents
    FOR UPDATE USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));


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
DROP POLICY IF EXISTS "Users can manage payments of their company docs" ON public.sales_document_payments;

CREATE POLICY "Users can manage payments of their company docs" ON public.sales_document_payments
    FOR ALL USING (
        document_id IN (
            SELECT id FROM public.sales_documents WHERE company_id IN (
                SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
            )
        )
    );

-- 4. Sales NFes
DROP POLICY IF EXISTS "Users can manage nfes of their company docs" ON public.sales_document_nfes;

CREATE POLICY "Users can manage nfes of their company docs" ON public.sales_document_nfes
    FOR ALL USING (
        document_id IN (
            SELECT id FROM public.sales_documents WHERE company_id IN (
                SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
            )
        )
    );

-- 5. Sales History (Skipped - table might ideally be handled by trigger security definers or audit logs module)
-- Dropped from this RLS fix because it caused "relation does not exist" error during push.


COMMIT;
