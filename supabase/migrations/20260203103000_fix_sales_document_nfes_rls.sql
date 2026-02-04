-- P1: Fix sales_document_nfes RLS to use company_members (not company_users)

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = 'sales_document_nfes'
    ) THEN
        ALTER TABLE public.sales_document_nfes ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Users can manage nfes of their company docs" ON public.sales_document_nfes;
        DROP POLICY IF EXISTS "sales_nfes_access" ON public.sales_document_nfes;
        DROP POLICY IF EXISTS "sales_document_nfes_access" ON public.sales_document_nfes;

        CREATE POLICY "sales_document_nfes_access" ON public.sales_document_nfes
            FOR ALL
            USING (
                document_id IN (
                    SELECT id FROM public.sales_documents
                    WHERE company_id IN (
                        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
                    )
                )
            )
            WITH CHECK (
                document_id IN (
                    SELECT id FROM public.sales_documents
                    WHERE company_id IN (
                        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

COMMIT;
