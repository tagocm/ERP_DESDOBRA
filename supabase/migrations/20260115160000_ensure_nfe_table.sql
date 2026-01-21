-- Ensure sales_document_nfes table exists
CREATE TABLE IF NOT EXISTS public.sales_document_nfes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,

    nfe_number BIGINT,
    nfe_series INTEGER,
    nfe_key TEXT,
    
    status TEXT NOT NULL CHECK (status IN ('authorized', 'cancelled', 'processing', 'error')),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    is_antecipada BOOLEAN DEFAULT FALSE,
    details TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Re-create indexes regardless (if not exists is safe)
CREATE INDEX IF NOT EXISTS idx_sales_nfes_doc ON public.sales_document_nfes(document_id);

-- Enable RLS
ALTER TABLE public.sales_document_nfes ENABLE ROW LEVEL SECURITY;

-- Re-create policies (dropping first to avoid conflicts if they exist but table was wonky)
DROP POLICY IF EXISTS "Users can manage nfes of their company docs" ON public.sales_document_nfes;

CREATE POLICY "Users can manage nfes of their company docs" ON public.sales_document_nfes
    FOR ALL USING (
        document_id IN (
            SELECT id FROM public.sales_documents WHERE company_id IN (
                SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Refresh schema cache workaround: notify pgrst
NOTIFY pgrst, 'reload config';
