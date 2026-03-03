BEGIN;

-- =====================================================
-- A) Production Sectors (minimal)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.production_sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.production_sectors IS 'Production sectors (e.g. PRODUCAO_GRANOLA, ENVASE)';
COMMENT ON COLUMN public.production_sectors.code IS 'Unique business code per company for active rows';
COMMENT ON COLUMN public.production_sectors.name IS 'Display name of the production sector';

CREATE UNIQUE INDEX IF NOT EXISTS production_sectors_company_code_unique_active
    ON public.production_sectors (company_id, lower(code))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS production_sectors_company_active_idx
    ON public.production_sectors (company_id, is_active)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS production_sectors_updated_at ON public.production_sectors;
CREATE TRIGGER production_sectors_updated_at
    BEFORE UPDATE ON public.production_sectors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.production_sectors ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.production_sectors TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'production_sectors'
          AND policyname = 'production_sectors_select'
    ) THEN
        EXECUTE 'CREATE POLICY production_sectors_select ON public.production_sectors FOR SELECT USING (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'production_sectors'
          AND policyname = 'production_sectors_insert'
    ) THEN
        EXECUTE 'CREATE POLICY production_sectors_insert ON public.production_sectors FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'production_sectors'
          AND policyname = 'production_sectors_update'
    ) THEN
        EXECUTE 'CREATE POLICY production_sectors_update ON public.production_sectors FOR UPDATE USING (public.is_member_of(company_id))';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'production_sectors'
          AND policyname = 'production_sectors_delete'
    ) THEN
        EXECUTE 'CREATE POLICY production_sectors_delete ON public.production_sectors FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

-- =====================================================
-- B) Work Orders links: sector + parent work order
-- =====================================================
ALTER TABLE public.work_orders
    ADD COLUMN IF NOT EXISTS sector_id UUID,
    ADD COLUMN IF NOT EXISTS parent_work_order_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_sector_id_fkey'
    ) THEN
        ALTER TABLE public.work_orders
            ADD CONSTRAINT work_orders_sector_id_fkey
            FOREIGN KEY (sector_id) REFERENCES public.production_sectors(id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_parent_work_order_id_fkey'
    ) THEN
        ALTER TABLE public.work_orders
            ADD CONSTRAINT work_orders_parent_work_order_id_fkey
            FOREIGN KEY (parent_work_order_id) REFERENCES public.work_orders(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS work_orders_company_sector_idx
    ON public.work_orders (company_id, sector_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS work_orders_company_parent_work_order_idx
    ON public.work_orders (company_id, parent_work_order_id)
    WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_work_order_links_company_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_sector_company_id UUID;
    v_parent_company_id UUID;
BEGIN
    IF NEW.sector_id IS NOT NULL THEN
        SELECT company_id
          INTO v_sector_company_id
          FROM public.production_sectors
         WHERE id = NEW.sector_id
           AND deleted_at IS NULL
         LIMIT 1;

        IF v_sector_company_id IS NULL THEN
            RAISE EXCEPTION 'Setor de producao invalido ou inativo para esta empresa';
        END IF;

        IF NEW.company_id IS DISTINCT FROM v_sector_company_id THEN
            RAISE EXCEPTION 'Setor de producao pertence a outra empresa';
        END IF;
    END IF;

    IF NEW.parent_work_order_id IS NOT NULL THEN
        IF NEW.id IS NOT NULL AND NEW.parent_work_order_id = NEW.id THEN
            RAISE EXCEPTION 'Ordem nao pode referenciar a si mesma como ordem mae';
        END IF;

        SELECT company_id
          INTO v_parent_company_id
          FROM public.work_orders
         WHERE id = NEW.parent_work_order_id
         LIMIT 1;

        IF v_parent_company_id IS NULL THEN
            RAISE EXCEPTION 'Ordem mae informada nao existe';
        END IF;

        IF NEW.company_id IS DISTINCT FROM v_parent_company_id THEN
            RAISE EXCEPTION 'Ordem mae pertence a outra empresa';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_work_order_links_company_scope ON public.work_orders;
CREATE TRIGGER trg_validate_work_order_links_company_scope
    BEFORE INSERT OR UPDATE OF company_id, sector_id, parent_work_order_id
    ON public.work_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_work_order_links_company_scope();

-- =====================================================
-- C) Atomic creation RPC (parent + child work orders)
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_work_orders_with_dependencies(
    p_company_id UUID,
    p_parent_item_id UUID,
    p_parent_bom_id UUID,
    p_parent_planned_qty NUMERIC,
    p_parent_scheduled_date DATE,
    p_parent_notes TEXT DEFAULT NULL,
    p_parent_sector_id UUID DEFAULT NULL,
    p_children JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_id UUID;
    v_child JSONB;
    v_child_id UUID;
    v_child_ids UUID[] := ARRAY[]::UUID[];
    v_child_item_id UUID;
    v_child_bom_id UUID;
    v_child_planned_qty NUMERIC;
    v_child_scheduled_date DATE;
    v_child_notes TEXT;
    v_child_sector_id UUID;
BEGIN
    IF p_parent_planned_qty IS NULL OR p_parent_planned_qty <= 0 THEN
        RAISE EXCEPTION 'Quantidade planejada da OP mae deve ser maior que zero';
    END IF;

    INSERT INTO public.work_orders (
        company_id,
        item_id,
        bom_id,
        planned_qty,
        produced_qty,
        status,
        scheduled_date,
        notes,
        sector_id,
        parent_work_order_id
    )
    VALUES (
        p_company_id,
        p_parent_item_id,
        p_parent_bom_id,
        p_parent_planned_qty,
        0,
        'planned',
        p_parent_scheduled_date,
        p_parent_notes,
        p_parent_sector_id,
        NULL
    )
    RETURNING id INTO v_parent_id;

    FOR v_child IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(p_children, '[]'::jsonb))
    LOOP
        v_child_item_id := NULLIF(v_child->>'item_id', '')::UUID;
        v_child_bom_id := NULLIF(v_child->>'bom_id', '')::UUID;
        v_child_planned_qty := NULLIF(v_child->>'planned_qty', '')::NUMERIC;
        v_child_scheduled_date := COALESCE(NULLIF(v_child->>'scheduled_date', '')::DATE, p_parent_scheduled_date);
        v_child_notes := NULLIF(v_child->>'notes', '');
        v_child_sector_id := NULLIF(v_child->>'sector_id', '')::UUID;

        IF v_child_item_id IS NULL THEN
            RAISE EXCEPTION 'Dependencia sem item_id valido';
        END IF;

        IF v_child_bom_id IS NULL THEN
            RAISE EXCEPTION 'Dependencia sem bom_id valido';
        END IF;

        IF v_child_planned_qty IS NULL OR v_child_planned_qty <= 0 THEN
            RAISE EXCEPTION 'Dependencia com planned_qty invalido';
        END IF;

        INSERT INTO public.work_orders (
            company_id,
            item_id,
            bom_id,
            planned_qty,
            produced_qty,
            status,
            scheduled_date,
            notes,
            sector_id,
            parent_work_order_id
        )
        VALUES (
            p_company_id,
            v_child_item_id,
            v_child_bom_id,
            v_child_planned_qty,
            0,
            'planned',
            v_child_scheduled_date,
            v_child_notes,
            v_child_sector_id,
            v_parent_id
        )
        RETURNING id INTO v_child_id;

        v_child_ids := array_append(v_child_ids, v_child_id);
    END LOOP;

    RETURN jsonb_build_object(
        'parent_work_order_id', v_parent_id,
        'child_work_order_ids', to_jsonb(v_child_ids)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_work_orders_with_dependencies(
    UUID,
    UUID,
    UUID,
    NUMERIC,
    DATE,
    TEXT,
    UUID,
    JSONB
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
