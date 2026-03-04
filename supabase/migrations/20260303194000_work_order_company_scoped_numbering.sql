BEGIN;

-- =====================================================
-- A) Per-company sequence state
-- =====================================================
CREATE TABLE IF NOT EXISTS public.work_order_sequences (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    next_number BIGINT NOT NULL CHECK (next_number >= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.work_order_sequences IS 'Per-company sequence state for production work order document numbers.';
COMMENT ON COLUMN public.work_order_sequences.next_number IS 'Next document number to reserve for the company.';

DROP TRIGGER IF EXISTS work_order_sequences_updated_at ON public.work_order_sequences;
CREATE TRIGGER work_order_sequences_updated_at
    BEFORE UPDATE ON public.work_order_sequences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.work_order_sequences ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.work_order_sequences TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'work_order_sequences'
          AND policyname = 'work_order_sequences_select'
    ) THEN
        EXECUTE 'CREATE POLICY work_order_sequences_select ON public.work_order_sequences FOR SELECT USING (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'work_order_sequences'
          AND policyname = 'work_order_sequences_insert'
    ) THEN
        EXECUTE 'CREATE POLICY work_order_sequences_insert ON public.work_order_sequences FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'work_order_sequences'
          AND policyname = 'work_order_sequences_update'
    ) THEN
        EXECUTE 'CREATE POLICY work_order_sequences_update ON public.work_order_sequences FOR UPDATE USING (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'work_order_sequences'
          AND policyname = 'work_order_sequences_delete'
    ) THEN
        EXECUTE 'CREATE POLICY work_order_sequences_delete ON public.work_order_sequences FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

-- =====================================================
-- B) Atomic number reservation per company
-- =====================================================
CREATE OR REPLACE FUNCTION public.next_work_order_number(p_company_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_assigned BIGINT;
    v_seed BIGINT;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'company_id e obrigatorio para gerar numero da OP';
    END IF;

    -- Serialize per company to avoid concurrent collisions.
    PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text)::BIGINT);

    SELECT COALESCE(MAX(document_number), 0) + 1
      INTO v_seed
      FROM public.work_orders
     WHERE company_id = p_company_id;

    INSERT INTO public.work_order_sequences (company_id, next_number, updated_at)
    VALUES (p_company_id, v_seed + 1, now())
    ON CONFLICT (company_id) DO NOTHING
    RETURNING next_number - 1 INTO v_assigned;

    IF v_assigned IS NULL THEN
        UPDATE public.work_order_sequences
           SET next_number = next_number + 1,
               updated_at = now()
         WHERE company_id = p_company_id
     RETURNING next_number - 1 INTO v_assigned;
    END IF;

    RETURN v_assigned;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_work_order_number(UUID) TO authenticated;

-- Keep trigger/function name used by existing codebase, but change behavior to company-scoped.
CREATE OR REPLACE FUNCTION public.assign_work_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.document_number IS NULL THEN
        NEW.document_number := public.next_work_order_number(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assign_work_order_number ON public.work_orders;
CREATE TRIGGER trigger_assign_work_order_number
    BEFORE INSERT ON public.work_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_work_order_number();

-- =====================================================
-- C) Backfill helper for legacy rows
-- =====================================================
CREATE OR REPLACE FUNCTION public.backfill_work_order_document_numbers()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    WITH company_max AS (
        SELECT company_id, COALESCE(MAX(document_number), 0) AS max_document_number
          FROM public.work_orders
         GROUP BY company_id
    ),
    missing AS (
        SELECT w.id,
               w.company_id,
               cm.max_document_number
               + ROW_NUMBER() OVER (PARTITION BY w.company_id ORDER BY w.created_at, w.id) AS new_document_number
          FROM public.work_orders w
          JOIN company_max cm ON cm.company_id = w.company_id
         WHERE w.document_number IS NULL
    )
    UPDATE public.work_orders w
       SET document_number = m.new_document_number
      FROM missing m
     WHERE w.id = m.id;

    INSERT INTO public.work_order_sequences (company_id, next_number, updated_at)
    SELECT w.company_id,
           COALESCE(MAX(w.document_number), 0) + 1,
           now()
      FROM public.work_orders w
     GROUP BY w.company_id
    ON CONFLICT (company_id) DO UPDATE
        SET next_number = EXCLUDED.next_number,
            updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_work_order_document_numbers() TO authenticated;

SELECT public.backfill_work_order_document_numbers();

-- =====================================================
-- D) Integrity: unique number per company (active rows)
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_company_document_number_unique_active
    ON public.work_orders (company_id, document_number)
    WHERE deleted_at IS NULL
      AND document_number IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
