BEGIN;

-- =====================================================
-- A) Inventory Count Header
-- =====================================================
CREATE TABLE IF NOT EXISTS public.inventory_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    number INTEGER,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    counted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(auth_user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    posted_by UUID REFERENCES public.user_profiles(auth_user_id) ON DELETE SET NULL,
    posted_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.inventory_counts
    ALTER COLUMN number TYPE INTEGER
    USING number::INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'inventory_counts_status_check'
          AND conrelid = 'public.inventory_counts'::regclass
    ) THEN
        ALTER TABLE public.inventory_counts
            ADD CONSTRAINT inventory_counts_status_check
            CHECK (status IN ('DRAFT', 'POSTED', 'CANCELED'));
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_counts_company_number_unique_active
    ON public.inventory_counts (company_id, number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_counts_company_status_idx
    ON public.inventory_counts (company_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_counts_company_counted_at_idx
    ON public.inventory_counts (company_id, counted_at DESC)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS inventory_counts_updated_at ON public.inventory_counts;
CREATE TRIGGER inventory_counts_updated_at
    BEFORE UPDATE ON public.inventory_counts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.inventory_counts TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_counts'
          AND policyname = 'inventory_counts_select'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_counts_select ON public.inventory_counts FOR SELECT USING (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_counts'
          AND policyname = 'inventory_counts_insert'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_counts_insert ON public.inventory_counts FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_counts'
          AND policyname = 'inventory_counts_update'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_counts_update ON public.inventory_counts FOR UPDATE USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_counts'
          AND policyname = 'inventory_counts_delete'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_counts_delete ON public.inventory_counts FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_counts'
          AND policyname = 'inventory_counts_update'
    ) THEN
        EXECUTE 'ALTER POLICY inventory_counts_update ON public.inventory_counts USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))';
    END IF;
END
$$;

-- =====================================================
-- B) Inventory Count Lines
-- =====================================================
CREATE TABLE IF NOT EXISTS public.inventory_count_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    inventory_count_id UUID NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    system_qty_base NUMERIC(15, 4) NOT NULL DEFAULT 0,
    counted_qty_base NUMERIC(15, 4),
    diff_qty_base NUMERIC(15, 4) NOT NULL DEFAULT 0,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'inventory_count_lines_counted_qty_non_negative'
          AND conrelid = 'public.inventory_count_lines'::regclass
    ) THEN
        ALTER TABLE public.inventory_count_lines
            ADD CONSTRAINT inventory_count_lines_counted_qty_non_negative
            CHECK (counted_qty_base IS NULL OR counted_qty_base >= 0);
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_count_lines_count_item_unique
    ON public.inventory_count_lines (inventory_count_id, item_id);

CREATE INDEX IF NOT EXISTS inventory_count_lines_company_count_idx
    ON public.inventory_count_lines (company_id, inventory_count_id);

CREATE INDEX IF NOT EXISTS inventory_count_lines_company_item_idx
    ON public.inventory_count_lines (company_id, item_id);

DROP TRIGGER IF EXISTS inventory_count_lines_updated_at ON public.inventory_count_lines;
CREATE TRIGGER inventory_count_lines_updated_at
    BEFORE UPDATE ON public.inventory_count_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_inventory_count_line_diff()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.counted_qty_base IS NULL THEN
        NEW.diff_qty_base := 0;
    ELSE
        NEW.diff_qty_base := NEW.counted_qty_base - COALESCE(NEW.system_qty_base, 0);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_count_lines_sync_diff ON public.inventory_count_lines;
CREATE TRIGGER trg_inventory_count_lines_sync_diff
    BEFORE INSERT OR UPDATE OF system_qty_base, counted_qty_base
    ON public.inventory_count_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_inventory_count_line_diff();

ALTER TABLE public.inventory_count_lines ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.inventory_count_lines TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_count_lines'
          AND policyname = 'inventory_count_lines_select'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_count_lines_select ON public.inventory_count_lines FOR SELECT USING (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_count_lines'
          AND policyname = 'inventory_count_lines_insert'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_count_lines_insert ON public.inventory_count_lines FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_count_lines'
          AND policyname = 'inventory_count_lines_update'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_count_lines_update ON public.inventory_count_lines FOR UPDATE USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_count_lines'
          AND policyname = 'inventory_count_lines_delete'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_count_lines_delete ON public.inventory_count_lines FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_count_lines'
          AND policyname = 'inventory_count_lines_update'
    ) THEN
        EXECUTE 'ALTER POLICY inventory_count_lines_update ON public.inventory_count_lines USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))';
    END IF;
END
$$;

-- =====================================================
-- C) Sequence by company for inventory_counts.number
-- =====================================================
CREATE TABLE IF NOT EXISTS public.inventory_count_sequences (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    next_number INTEGER NOT NULL CHECK (next_number >= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_count_sequences
    ALTER COLUMN next_number TYPE INTEGER
    USING next_number::INTEGER;

DROP TRIGGER IF EXISTS inventory_count_sequences_updated_at ON public.inventory_count_sequences;
CREATE TRIGGER inventory_count_sequences_updated_at
    BEFORE UPDATE ON public.inventory_count_sequences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.inventory_count_sequences ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.inventory_count_sequences TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_count_sequences'
          AND policyname = 'inventory_count_sequences_select'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_count_sequences_select ON public.inventory_count_sequences FOR SELECT USING (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_count_sequences'
          AND policyname = 'inventory_count_sequences_insert'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_count_sequences_insert ON public.inventory_count_sequences FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_count_sequences'
          AND policyname = 'inventory_count_sequences_update'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_count_sequences_update ON public.inventory_count_sequences FOR UPDATE USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_count_sequences'
          AND policyname = 'inventory_count_sequences_delete'
    ) THEN
        EXECUTE 'CREATE POLICY inventory_count_sequences_delete ON public.inventory_count_sequences FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_count_sequences'
          AND policyname = 'inventory_count_sequences_update'
    ) THEN
        EXECUTE 'ALTER POLICY inventory_count_sequences_update ON public.inventory_count_sequences USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))';
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.next_inventory_count_number(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_assigned INTEGER;
    v_seed INTEGER;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'company_id e obrigatorio para gerar numero do inventario';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(('inventory_count:' || p_company_id::text))::BIGINT);

    SELECT COALESCE(MAX(number), 0) + 1
      INTO v_seed
      FROM public.inventory_counts
     WHERE company_id = p_company_id
       AND deleted_at IS NULL;

    INSERT INTO public.inventory_count_sequences (company_id, next_number, updated_at)
    VALUES (p_company_id, v_seed + 1, now())
    ON CONFLICT (company_id) DO NOTHING
    RETURNING next_number - 1 INTO v_assigned;

    IF v_assigned IS NULL THEN
        UPDATE public.inventory_count_sequences
           SET next_number = next_number + 1,
               updated_at = now()
         WHERE company_id = p_company_id
     RETURNING next_number - 1 INTO v_assigned;
    END IF;

    RETURN v_assigned;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_inventory_count_number(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_inventory_count_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.number IS NULL THEN
        NEW.number := public.next_inventory_count_number(NEW.company_id);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assign_inventory_count_number ON public.inventory_counts;
CREATE TRIGGER trigger_assign_inventory_count_number
    BEFORE INSERT ON public.inventory_counts
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_inventory_count_number();

INSERT INTO public.inventory_count_sequences (company_id, next_number, updated_at)
SELECT company_id,
       COALESCE(MAX(number), 0) + 1,
       now()
  FROM public.inventory_counts
 GROUP BY company_id
ON CONFLICT (company_id) DO UPDATE
   SET next_number = GREATEST(public.inventory_count_sequences.next_number, EXCLUDED.next_number),
       updated_at = now();

UPDATE public.inventory_counts ic
   SET number = public.next_inventory_count_number(ic.company_id)
 WHERE ic.number IS NULL;

ALTER TABLE public.inventory_counts
    ALTER COLUMN number SET NOT NULL;

-- =====================================================
-- D) Post function (transactional and idempotent)
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_inventory_count_item_unique
    ON public.inventory_movements (company_id, reference_id, item_id)
    WHERE reference_type = 'inventory_count'
      AND movement_type = 'AJUSTE';

CREATE OR REPLACE FUNCTION public.post_inventory_count(
    p_inventory_count_id UUID,
    p_posted_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_count public.inventory_counts%ROWTYPE;
    v_line RECORD;
    v_diff NUMERIC(15, 4);
    v_qty_in NUMERIC(15, 4);
    v_qty_out NUMERIC(15, 4);
    v_qty_base NUMERIC(15, 4);
    v_notes TEXT;
    v_posted_items INTEGER := 0;
BEGIN
    SELECT *
      INTO v_count
      FROM public.inventory_counts
     WHERE id = p_inventory_count_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventario nao encontrado';
    END IF;

    IF v_count.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Inventario ja foi postado ou cancelado';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.inventory_movements im
         WHERE im.company_id = v_count.company_id
           AND im.reference_type = 'inventory_count'
           AND im.reference_id = v_count.id
    ) THEN
        RAISE EXCEPTION 'Inventario ja possui movimentos de ajuste lancados';
    END IF;

    FOR v_line IN
        SELECT l.*, i.name AS item_name, i.uom AS item_uom
          FROM public.inventory_count_lines l
          JOIN public.items i
            ON i.id = l.item_id
         WHERE l.inventory_count_id = v_count.id
           AND l.company_id = v_count.company_id
    LOOP
        IF v_line.counted_qty_base IS NULL THEN
            CONTINUE;
        END IF;

        v_diff := COALESCE(v_line.counted_qty_base, 0) - COALESCE(v_line.system_qty_base, 0);

        IF v_diff = 0 THEN
            CONTINUE;
        END IF;

        IF v_diff > 0 THEN
            v_qty_in := v_diff;
            v_qty_out := 0;
            v_qty_base := v_diff;
        ELSE
            v_qty_in := 0;
            v_qty_out := ABS(v_diff);
            v_qty_base := v_diff;
        END IF;

        v_notes := concat_ws(
            ' | ',
            format('Ajuste por inventario #%s', v_count.number),
            NULLIF(v_line.reason, ''),
            NULLIF(v_line.notes, '')
        );

        INSERT INTO public.inventory_movements (
            company_id,
            item_id,
            movement_type,
            qty_base,
            qty_in,
            qty_out,
            qty_display,
            uom_label,
            conversion_factor,
            occurred_at,
            reference_type,
            reference_id,
            reason,
            notes,
            created_by,
            source_ref
        ) VALUES (
            v_count.company_id,
            v_line.item_id,
            'AJUSTE',
            v_qty_base,
            v_qty_in,
            v_qty_out,
            ABS(v_diff),
            v_line.item_uom,
            1,
            v_count.counted_at,
            'inventory_count',
            v_count.id,
            'inventory_count',
            v_notes,
            p_posted_by,
            format('Inventario #%s', v_count.number)
        );

        v_posted_items := v_posted_items + 1;
    END LOOP;

    UPDATE public.inventory_counts
       SET status = 'POSTED',
           posted_by = p_posted_by,
           posted_at = now(),
           updated_at = now()
     WHERE id = v_count.id;

    RETURN jsonb_build_object(
        'inventory_count_id', v_count.id,
        'inventory_count_number', v_count.number,
        'posted_items', v_posted_items,
        'status', 'POSTED'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_inventory_count(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
