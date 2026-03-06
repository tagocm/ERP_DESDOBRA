BEGIN;

ALTER TABLE public.commission_settlements
    ADD COLUMN IF NOT EXISTS document_number BIGINT;

COMMENT ON COLUMN public.commission_settlements.document_number IS 'Numero sequencial visivel do acerto de comissao por empresa.';

CREATE TABLE IF NOT EXISTS public.commission_settlement_sequences (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    next_number BIGINT NOT NULL CHECK (next_number >= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commission_settlement_sequences IS 'Estado da sequencia por empresa para numeracao de acertos de comissao.';
COMMENT ON COLUMN public.commission_settlement_sequences.next_number IS 'Proximo numero a ser reservado para a empresa.';

DROP TRIGGER IF EXISTS commission_settlement_sequences_updated_at ON public.commission_settlement_sequences;
CREATE TRIGGER commission_settlement_sequences_updated_at
    BEFORE UPDATE ON public.commission_settlement_sequences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.commission_settlement_sequences ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.commission_settlement_sequences TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'commission_settlement_sequences'
          AND policyname = 'commission_settlement_sequences_select'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlement_sequences_select ON public.commission_settlement_sequences FOR SELECT USING (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'commission_settlement_sequences'
          AND policyname = 'commission_settlement_sequences_insert'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlement_sequences_insert ON public.commission_settlement_sequences FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'commission_settlement_sequences'
          AND policyname = 'commission_settlement_sequences_update'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlement_sequences_update ON public.commission_settlement_sequences FOR UPDATE USING (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'commission_settlement_sequences'
          AND policyname = 'commission_settlement_sequences_delete'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlement_sequences_delete ON public.commission_settlement_sequences FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.next_commission_settlement_number(p_company_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_assigned BIGINT;
    v_seed BIGINT;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'company_id e obrigatorio para gerar numero do acerto de comissao';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text)::BIGINT);

    SELECT COALESCE(MAX(document_number), 0) + 1
      INTO v_seed
      FROM public.commission_settlements
     WHERE company_id = p_company_id;

    INSERT INTO public.commission_settlement_sequences (company_id, next_number, updated_at)
    VALUES (p_company_id, v_seed + 1, now())
    ON CONFLICT (company_id) DO NOTHING
    RETURNING next_number - 1 INTO v_assigned;

    IF v_assigned IS NULL THEN
        UPDATE public.commission_settlement_sequences
           SET next_number = next_number + 1,
               updated_at = now()
         WHERE company_id = p_company_id
     RETURNING next_number - 1 INTO v_assigned;
    END IF;

    RETURN v_assigned;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_commission_settlement_number(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_commission_settlement_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.document_number IS NULL THEN
        NEW.document_number := public.next_commission_settlement_number(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assign_commission_settlement_number ON public.commission_settlements;
CREATE TRIGGER trigger_assign_commission_settlement_number
    BEFORE INSERT ON public.commission_settlements
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_commission_settlement_number();

CREATE OR REPLACE FUNCTION public.backfill_commission_settlement_document_numbers()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    WITH company_max AS (
        SELECT company_id, COALESCE(MAX(document_number), 0) AS max_document_number
          FROM public.commission_settlements
         GROUP BY company_id
    ),
    missing AS (
        SELECT s.id,
               s.company_id,
               cm.max_document_number
               + ROW_NUMBER() OVER (PARTITION BY s.company_id ORDER BY s.created_at, s.id) AS new_document_number
          FROM public.commission_settlements s
          JOIN company_max cm ON cm.company_id = s.company_id
         WHERE s.document_number IS NULL
    )
    UPDATE public.commission_settlements s
       SET document_number = m.new_document_number
      FROM missing m
     WHERE s.id = m.id;

    INSERT INTO public.commission_settlement_sequences (company_id, next_number, updated_at)
    SELECT s.company_id,
           COALESCE(MAX(s.document_number), 0) + 1,
           now()
      FROM public.commission_settlements s
     GROUP BY s.company_id
    ON CONFLICT (company_id) DO UPDATE
        SET next_number = EXCLUDED.next_number,
            updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_commission_settlement_document_numbers() TO authenticated;

SELECT public.backfill_commission_settlement_document_numbers();

CREATE UNIQUE INDEX IF NOT EXISTS commission_settlements_company_document_number_uidx
    ON public.commission_settlements (company_id, document_number)
    WHERE document_number IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
