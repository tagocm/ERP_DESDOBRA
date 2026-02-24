-- FASE 1 - DB
-- Ajustes finais do schema de allocations + FK de suggested_account_id.

ALTER TABLE public.ar_installment_allocations
    ALTER COLUMN amount TYPE numeric(14,2);

ALTER TABLE public.ap_installment_allocations
    ALTER COLUMN amount TYPE numeric(14,2);

CREATE INDEX IF NOT EXISTS idx_ar_installment_allocations_company_installment
    ON public.ar_installment_allocations(company_id, ar_installment_id);

CREATE INDEX IF NOT EXISTS idx_ar_installment_allocations_company_gl_account
    ON public.ar_installment_allocations(company_id, gl_account_id);

CREATE INDEX IF NOT EXISTS idx_ap_installment_allocations_company_installment
    ON public.ap_installment_allocations(company_id, ap_installment_id);

CREATE INDEX IF NOT EXISTS idx_ap_installment_allocations_company_gl_account
    ON public.ap_installment_allocations(company_id, gl_account_id);

-- Evita duplicidade de mesma conta+centro para mesma parcela.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ar_installment_allocations_installment_account_cc
    ON public.ar_installment_allocations(
        ar_installment_id,
        gl_account_id,
        COALESCE(cost_center_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_ap_installment_allocations_installment_account_cc
    ON public.ap_installment_allocations(
        ap_installment_id,
        gl_account_id,
        COALESCE(cost_center_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'financial_event_installments_suggested_account_id_fkey'
    ) THEN
        ALTER TABLE public.financial_event_installments
            ADD CONSTRAINT financial_event_installments_suggested_account_id_fkey
            FOREIGN KEY (suggested_account_id)
            REFERENCES public.gl_accounts(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_financial_event_installments_suggested_account
    ON public.financial_event_installments(suggested_account_id);
