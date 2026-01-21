-- Ensure sales_document_payments table exists
CREATE TABLE IF NOT EXISTS public.sales_document_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_payments_doc ON public.sales_document_payments(document_id);

ALTER TABLE public.sales_document_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Users can manage payments of their company docs' 
        AND polrelid = 'public.sales_document_payments'::regclass
    ) THEN
        CREATE POLICY "Users can manage payments of their company docs" ON public.sales_document_payments
            FOR ALL USING (
                document_id IN (
                    SELECT id FROM public.sales_documents WHERE company_id IN (
                        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
