BEGIN;

-- =====================================================
-- A) Capacity field (max recipes supported)
-- =====================================================
ALTER TABLE public.production_sectors
    ADD COLUMN IF NOT EXISTS capacity_recipes INTEGER;

UPDATE public.production_sectors
   SET capacity_recipes = 1
 WHERE capacity_recipes IS NULL;

ALTER TABLE public.production_sectors
    ALTER COLUMN capacity_recipes SET DEFAULT 1,
    ALTER COLUMN capacity_recipes SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'production_sectors_capacity_recipes_check'
           AND conrelid = 'public.production_sectors'::regclass
    ) THEN
        ALTER TABLE public.production_sectors
            ADD CONSTRAINT production_sectors_capacity_recipes_check
            CHECK (capacity_recipes >= 1);
    END IF;
END
$$;

COMMENT ON COLUMN public.production_sectors.capacity_recipes IS 'Maximum number of recipes supported by the sector.';

-- =====================================================
-- B) Per-company sequence state for sector code
-- =====================================================
CREATE TABLE IF NOT EXISTS public.production_sector_sequences (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    next_number BIGINT NOT NULL CHECK (next_number >= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.production_sector_sequences IS 'Per-company sequence state for production sector code generation.';
COMMENT ON COLUMN public.production_sector_sequences.next_number IS 'Next numeric code to reserve for production sector.';

DROP TRIGGER IF EXISTS production_sector_sequences_updated_at ON public.production_sector_sequences;
CREATE TRIGGER production_sector_sequences_updated_at
    BEFORE UPDATE ON public.production_sector_sequences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.production_sector_sequences ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_sector_sequences TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'production_sector_sequences'
          AND policyname = 'production_sector_sequences_select'
    ) THEN
        EXECUTE 'CREATE POLICY production_sector_sequences_select ON public.production_sector_sequences FOR SELECT USING (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'production_sector_sequences'
          AND policyname = 'production_sector_sequences_insert'
    ) THEN
        EXECUTE 'CREATE POLICY production_sector_sequences_insert ON public.production_sector_sequences FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'production_sector_sequences'
          AND policyname = 'production_sector_sequences_update'
    ) THEN
        EXECUTE 'CREATE POLICY production_sector_sequences_update ON public.production_sector_sequences FOR UPDATE USING (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'production_sector_sequences'
          AND policyname = 'production_sector_sequences_delete'
    ) THEN
        EXECUTE 'CREATE POLICY production_sector_sequences_delete ON public.production_sector_sequences FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

-- =====================================================
-- C) Atomic numeric code reservation
-- =====================================================
CREATE OR REPLACE FUNCTION public.next_production_sector_code(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_assigned BIGINT;
    v_seed BIGINT;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'company_id e obrigatorio para gerar codigo do setor';
    END IF;

    -- Serialize code generation per company to avoid collisions.
    PERFORM pg_advisory_xact_lock(hashtext(('production_sector:' || p_company_id::text))::BIGINT);

    SELECT COALESCE(MAX(code::BIGINT), 0) + 1
      INTO v_seed
      FROM public.production_sectors
     WHERE company_id = p_company_id
       AND code ~ '^[0-9]+$';

    INSERT INTO public.production_sector_sequences (company_id, next_number, updated_at)
    VALUES (p_company_id, v_seed + 1, now())
    ON CONFLICT (company_id) DO NOTHING
    RETURNING next_number - 1 INTO v_assigned;

    IF v_assigned IS NULL THEN
        UPDATE public.production_sector_sequences
           SET next_number = next_number + 1,
               updated_at = now()
         WHERE company_id = p_company_id
     RETURNING next_number - 1 INTO v_assigned;
    END IF;

    RETURN v_assigned::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_production_sector_code(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_production_sector_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.code := public.next_production_sector_code(NEW.company_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assign_production_sector_code ON public.production_sectors;
CREATE TRIGGER trigger_assign_production_sector_code
    BEFORE INSERT ON public.production_sectors
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_production_sector_code();

-- =====================================================
-- D) Sync sequence with existing rows
-- =====================================================
INSERT INTO public.production_sector_sequences (company_id, next_number, updated_at)
SELECT company_id,
       COALESCE(MAX(CASE WHEN code ~ '^[0-9]+$' THEN code::BIGINT END), 0) + 1,
       now()
  FROM public.production_sectors
 GROUP BY company_id
ON CONFLICT (company_id) DO UPDATE
   SET next_number = GREATEST(public.production_sector_sequences.next_number, EXCLUDED.next_number),
       updated_at = now();

NOTIFY pgrst, 'reload schema';

COMMIT;
