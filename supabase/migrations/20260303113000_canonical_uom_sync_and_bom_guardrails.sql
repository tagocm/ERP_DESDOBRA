-- Canonical UOM enforcement (uom_id as source of truth)
-- This migration keeps legacy text columns synchronized to canonical uom_id values.
-- Legacy columns remain for compatibility, but are no longer authoritative.

BEGIN;

-- 1) Backfill missing items.uom_id
DO $$
DECLARE
    r_item RECORD;
    v_uom_id UUID;
    v_uom_abbrev TEXT;
BEGIN
    FOR r_item IN
        SELECT id, company_id, COALESCE(NULLIF(TRIM(uom), ''), 'UN') AS uom
        FROM public.items
        WHERE uom_id IS NULL
          AND deleted_at IS NULL
    LOOP
        SELECT id, abbrev
          INTO v_uom_id, v_uom_abbrev
          FROM public.uoms
         WHERE company_id = r_item.company_id
           AND (
               lower(abbrev) = lower(r_item.uom)
            OR lower(name) = lower(r_item.uom)
           )
         ORDER BY is_active DESC, sort_order ASC
         LIMIT 1;

        IF v_uom_id IS NULL THEN
            INSERT INTO public.uoms (company_id, name, abbrev, is_active, sort_order)
            VALUES (
                r_item.company_id,
                CASE WHEN upper(r_item.uom) = 'UN' THEN 'Unidade' ELSE upper(r_item.uom) END,
                CASE WHEN upper(r_item.uom) = 'UN' THEN 'Un' ELSE upper(r_item.uom) END,
                TRUE,
                999
            )
            ON CONFLICT (company_id, abbrev) DO UPDATE SET updated_at = now()
            RETURNING id, abbrev INTO v_uom_id, v_uom_abbrev;
        END IF;

        UPDATE public.items
           SET uom_id = v_uom_id
         WHERE id = r_item.id;
    END LOOP;
END $$;

-- 2) Backfill/sync legacy text columns from canonical IDs
UPDATE public.items i
   SET uom = u.abbrev
  FROM public.uoms u
 WHERE i.uom_id = u.id
   AND COALESCE(i.uom, '') IS DISTINCT FROM COALESCE(u.abbrev, '');

UPDATE public.item_purchase_profiles p
   SET purchase_uom = u.abbrev
  FROM public.uoms u
 WHERE p.purchase_uom_id = u.id
   AND COALESCE(p.purchase_uom, '') IS DISTINCT FROM COALESCE(u.abbrev, '');

UPDATE public.item_production_profiles p
   SET production_uom = u.abbrev
  FROM public.uoms u
 WHERE p.production_uom_id = u.id
   AND COALESCE(p.production_uom, '') IS DISTINCT FROM COALESCE(u.abbrev, '');

UPDATE public.bom_lines bl
   SET uom = u.abbrev
  FROM public.items i
  JOIN public.uoms u ON u.id = i.uom_id
 WHERE bl.component_item_id = i.id
   AND COALESCE(bl.uom, '') IS DISTINCT FROM COALESCE(u.abbrev, '');

UPDATE public.bom_headers bh
   SET yield_uom = u.abbrev
  FROM public.items i
  JOIN public.uoms u ON u.id = i.uom_id
 WHERE bh.item_id = i.id
   AND COALESCE(bh.yield_uom, '') IS DISTINCT FROM COALESCE(u.abbrev, '');

-- 3) Trigger helpers: keep legacy textual UOM in sync with *_uom_id
CREATE OR REPLACE FUNCTION public._resolve_uom_from_id(p_uom_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT u.abbrev
      FROM public.uoms u
     WHERE u.id = p_uom_id
     LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.sync_items_legacy_uom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_uom TEXT;
    v_uom_id UUID;
    v_raw_uom TEXT;
BEGIN
    IF NEW.uom_id IS NULL THEN
        v_raw_uom := COALESCE(NULLIF(TRIM(NEW.uom), ''), 'UN');

        SELECT id
          INTO v_uom_id
          FROM public.uoms
         WHERE company_id = NEW.company_id
           AND (lower(abbrev) = lower(v_raw_uom) OR lower(name) = lower(v_raw_uom))
         ORDER BY is_active DESC, sort_order ASC
         LIMIT 1;

        IF v_uom_id IS NULL THEN
            INSERT INTO public.uoms (company_id, name, abbrev, is_active, sort_order)
            VALUES (
                NEW.company_id,
                CASE WHEN upper(v_raw_uom) = 'UN' THEN 'Unidade' ELSE upper(v_raw_uom) END,
                CASE WHEN upper(v_raw_uom) = 'UN' THEN 'Un' ELSE upper(v_raw_uom) END,
                TRUE,
                999
            )
            ON CONFLICT (company_id, abbrev) DO UPDATE SET updated_at = now()
            RETURNING id INTO v_uom_id;
        END IF;

        NEW.uom_id := v_uom_id;
    END IF;

    IF NEW.uom_id IS NOT NULL THEN
        v_uom := public._resolve_uom_from_id(NEW.uom_id);
        IF v_uom IS NOT NULL THEN
            NEW.uom := v_uom;
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_items_legacy_uom ON public.items;
CREATE TRIGGER trg_sync_items_legacy_uom
BEFORE INSERT OR UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.sync_items_legacy_uom();

CREATE OR REPLACE FUNCTION public.sync_item_purchase_profiles_legacy_uom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_uom TEXT;
    v_item_uom_id UUID;
BEGIN
    IF NEW.purchase_uom_id IS NULL AND NEW.item_id IS NOT NULL THEN
        SELECT i.uom_id INTO v_item_uom_id
          FROM public.items i
         WHERE i.id = NEW.item_id
         LIMIT 1;
        IF v_item_uom_id IS NOT NULL THEN
            NEW.purchase_uom_id := v_item_uom_id;
        END IF;
    END IF;

    IF NEW.purchase_uom_id IS NOT NULL THEN
        v_uom := public._resolve_uom_from_id(NEW.purchase_uom_id);
        IF v_uom IS NOT NULL THEN
            NEW.purchase_uom := v_uom;
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_item_purchase_profiles_legacy_uom ON public.item_purchase_profiles;
CREATE TRIGGER trg_sync_item_purchase_profiles_legacy_uom
BEFORE INSERT OR UPDATE ON public.item_purchase_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_item_purchase_profiles_legacy_uom();

CREATE OR REPLACE FUNCTION public.sync_item_production_profiles_legacy_uom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_uom TEXT;
    v_item_uom_id UUID;
BEGIN
    IF NEW.production_uom_id IS NULL AND NEW.item_id IS NOT NULL THEN
        SELECT i.uom_id INTO v_item_uom_id
          FROM public.items i
         WHERE i.id = NEW.item_id
         LIMIT 1;
        IF v_item_uom_id IS NOT NULL THEN
            NEW.production_uom_id := v_item_uom_id;
        END IF;
    END IF;

    IF NEW.production_uom_id IS NOT NULL THEN
        v_uom := public._resolve_uom_from_id(NEW.production_uom_id);
        IF v_uom IS NOT NULL THEN
            NEW.production_uom := v_uom;
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_item_production_profiles_legacy_uom ON public.item_production_profiles;
CREATE TRIGGER trg_sync_item_production_profiles_legacy_uom
BEFORE INSERT OR UPDATE ON public.item_production_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_item_production_profiles_legacy_uom();

CREATE OR REPLACE FUNCTION public.sync_bom_lines_legacy_uom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_uom TEXT;
BEGIN
    IF NEW.component_item_id IS NOT NULL THEN
        SELECT u.abbrev
          INTO v_uom
          FROM public.items i
          JOIN public.uoms u ON u.id = i.uom_id
         WHERE i.id = NEW.component_item_id
         LIMIT 1;

        IF v_uom IS NOT NULL THEN
            NEW.uom := v_uom;
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_bom_lines_legacy_uom ON public.bom_lines;
CREATE TRIGGER trg_sync_bom_lines_legacy_uom
BEFORE INSERT OR UPDATE ON public.bom_lines
FOR EACH ROW
EXECUTE FUNCTION public.sync_bom_lines_legacy_uom();

CREATE OR REPLACE FUNCTION public.sync_bom_headers_legacy_yield_uom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_uom TEXT;
BEGIN
    IF NEW.item_id IS NOT NULL THEN
        SELECT u.abbrev
          INTO v_uom
          FROM public.items i
          JOIN public.uoms u ON u.id = i.uom_id
         WHERE i.id = NEW.item_id
         LIMIT 1;

        IF v_uom IS NOT NULL THEN
            NEW.yield_uom := v_uom;
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_bom_headers_legacy_yield_uom ON public.bom_headers;
CREATE TRIGGER trg_sync_bom_headers_legacy_yield_uom
BEFORE INSERT OR UPDATE ON public.bom_headers
FOR EACH ROW
EXECUTE FUNCTION public.sync_bom_headers_legacy_yield_uom();

NOTIFY pgrst, 'reload schema';

COMMIT;
