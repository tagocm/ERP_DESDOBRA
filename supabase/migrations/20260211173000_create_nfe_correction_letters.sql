CREATE TABLE IF NOT EXISTS public.nfe_correction_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    nfe_emission_id UUID NOT NULL REFERENCES public.nfe_emissions(id) ON DELETE CASCADE,
    sales_document_id UUID REFERENCES public.sales_documents(id) ON DELETE SET NULL,
    access_key VARCHAR(44) NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    correction_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'authorized', 'rejected', 'failed')),
    c_stat VARCHAR(3),
    x_motivo TEXT,
    protocol VARCHAR(20),
    request_xml TEXT,
    response_xml TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nfe_correction_letters_unique_seq
    ON public.nfe_correction_letters(company_id, access_key, sequence);

CREATE INDEX IF NOT EXISTS idx_nfe_correction_letters_company_updated
    ON public.nfe_correction_letters(company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_nfe_correction_letters_emission
    ON public.nfe_correction_letters(nfe_emission_id);

CREATE OR REPLACE FUNCTION public.update_nfe_correction_letters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nfe_correction_letters_updated_at ON public.nfe_correction_letters;
CREATE TRIGGER trg_nfe_correction_letters_updated_at
    BEFORE UPDATE ON public.nfe_correction_letters
    FOR EACH ROW
    EXECUTE FUNCTION public.update_nfe_correction_letters_updated_at();

ALTER TABLE public.nfe_correction_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nfe_correction_letters_select_policy" ON public.nfe_correction_letters;
CREATE POLICY "nfe_correction_letters_select_policy" ON public.nfe_correction_letters
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id
            FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "nfe_correction_letters_insert_policy" ON public.nfe_correction_letters;
CREATE POLICY "nfe_correction_letters_insert_policy" ON public.nfe_correction_letters
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id
            FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "nfe_correction_letters_update_policy" ON public.nfe_correction_letters;
CREATE POLICY "nfe_correction_letters_update_policy" ON public.nfe_correction_letters
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id
            FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "nfe_correction_letters_service_role_policy" ON public.nfe_correction_letters;
CREATE POLICY "nfe_correction_letters_service_role_policy" ON public.nfe_correction_letters
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
