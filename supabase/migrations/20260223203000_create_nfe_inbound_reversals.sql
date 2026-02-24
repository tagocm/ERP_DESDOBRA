-- Feature: NF-e de Entrada (Estorno) gerada a partir de NF-e de Saída autorizada
-- This table tracks the reversal request and its generated inbound emission.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nfe_inbound_reversals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

    -- Outbound (original) NF-e emission (must be authorized)
    outbound_emission_id uuid NOT NULL REFERENCES public.nfe_emissions(id) ON DELETE RESTRICT,
    outbound_access_key varchar(44) NOT NULL,
    outbound_sales_document_id uuid REFERENCES public.sales_documents(id) ON DELETE SET NULL,

    -- Inbound reversal emission (generated)
    inbound_emission_id uuid REFERENCES public.nfe_emissions(id) ON DELETE SET NULL,

    -- User intent / input snapshot
    mode text NOT NULL CHECK (mode IN ('TOTAL', 'PARCIAL')),
    reason_code text NOT NULL CHECK (reason_code IN (
        'MERCADORIA_NAO_ENTREGUE',
        'RECUSA_DESTINATARIO',
        'ENDERECO_INCORRETO',
        'ERRO_OPERACIONAL',
        'OUTROS'
    )),
    reason_other text,
    internal_notes text,
    selection jsonb NOT NULL DEFAULT '[]'::jsonb,

    -- Processing state (separate from nfe_emissions.status)
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'authorized', 'failed')),
    c_stat text,
    x_motivo text,

    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nfe_inbound_reversals_company_outbound_key
    ON public.nfe_inbound_reversals(company_id, outbound_access_key);

CREATE INDEX IF NOT EXISTS idx_nfe_inbound_reversals_company_status
    ON public.nfe_inbound_reversals(company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nfe_inbound_reversals_inbound_emission
    ON public.nfe_inbound_reversals(inbound_emission_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
    ) THEN
        DROP TRIGGER IF EXISTS trg_nfe_inbound_reversals_updated_at ON public.nfe_inbound_reversals;
        CREATE TRIGGER trg_nfe_inbound_reversals_updated_at
        BEFORE UPDATE ON public.nfe_inbound_reversals
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

ALTER TABLE public.nfe_inbound_reversals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nfe_inbound_reversals_select" ON public.nfe_inbound_reversals;
CREATE POLICY "nfe_inbound_reversals_select"
    ON public.nfe_inbound_reversals
    FOR SELECT
    TO authenticated
    USING (public.is_member_of(company_id));

DROP POLICY IF EXISTS "Service Role full access (nfe_inbound_reversals)" ON public.nfe_inbound_reversals;
CREATE POLICY "Service Role full access (nfe_inbound_reversals)"
    ON public.nfe_inbound_reversals
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;

