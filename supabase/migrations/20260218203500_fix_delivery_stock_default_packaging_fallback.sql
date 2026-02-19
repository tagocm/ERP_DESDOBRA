-- Fix: if sales_document_items.packaging_id is null, fallback to items.packaging_id
-- for stock conversion in deduct_stock_from_route.

BEGIN;

CREATE OR REPLACE FUNCTION public.deduct_stock_from_route(p_route_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id uuid;
    v_created_by_candidate uuid;
    v_created_by_safe uuid;
    v_created_by_fk_target text;
    r_delivery RECORD;
    r_item RECORD;
    v_source_ref TEXT;
    v_unit_cost NUMERIC;
    v_factor NUMERIC;
    v_qty_base NUMERIC;
BEGIN
    SELECT dr.company_id
      INTO v_company_id
      FROM public.delivery_routes dr
     WHERE dr.id = p_route_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Route not found' USING errcode = 'P0002';
    END IF;

    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_member_of(v_company_id) THEN
            RAISE EXCEPTION 'Forbidden' USING errcode = '28000';
        END IF;

        IF p_user_id IS NOT NULL AND p_user_id <> auth.uid() THEN
            RAISE EXCEPTION 'Forbidden' USING errcode = '28000';
        END IF;
    END IF;

    v_created_by_candidate := COALESCE(auth.uid(), p_user_id);
    v_created_by_safe := NULL;

    SELECT (ccu.table_schema || '.' || ccu.table_name)
      INTO v_created_by_fk_target
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.constraint_schema = tc.constraint_schema
     WHERE tc.table_schema = 'public'
       AND tc.table_name = 'inventory_movements'
       AND tc.constraint_type = 'FOREIGN KEY'
       AND kcu.column_name = 'created_by'
     LIMIT 1;

    IF v_created_by_candidate IS NOT NULL THEN
        IF v_created_by_fk_target = 'public.user_profiles' THEN
            IF EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.auth_user_id = v_created_by_candidate) THEN
                v_created_by_safe := v_created_by_candidate;
            END IF;
        ELSIF v_created_by_fk_target = 'auth.users' THEN
            IF EXISTS (SELECT 1 FROM auth.users au WHERE au.id = v_created_by_candidate) THEN
                v_created_by_safe := v_created_by_candidate;
            END IF;
        END IF;
    END IF;

    FOR r_delivery IN
        SELECT * FROM public.deliveries WHERE route_id = p_route_id
    LOOP
        v_source_ref := concat('Entrega #', r_delivery.number);

        FOR r_item IN
            SELECT
                di.*,
                sdi.item_id,
                sdi.quantity AS order_qty_display,
                sdi.qty_base AS order_qty_base,
                sdi.conversion_factor_snapshot,
                sdi.packaging_id AS sdi_packaging_id,
                i.packaging_id AS item_default_packaging_id,
                pkg_sdi.qty_in_base AS sdi_packaging_qty_in_base,
                pkg_item.qty_in_base AS item_default_packaging_qty_in_base,
                i.avg_cost
              FROM public.delivery_items di
              JOIN public.sales_document_items sdi ON sdi.id = di.sales_document_item_id
              LEFT JOIN public.items i ON sdi.item_id = i.id
              LEFT JOIN public.item_packaging pkg_sdi ON pkg_sdi.id = sdi.packaging_id
              LEFT JOIN public.item_packaging pkg_item ON pkg_item.id = i.packaging_id
             WHERE di.delivery_id = r_delivery.id
        LOOP
            v_unit_cost := COALESCE(r_item.avg_cost, 0);

            v_factor := COALESCE(
                CASE
                    WHEN COALESCE(r_item.order_qty_display, 0) > 0
                     AND r_item.order_qty_base IS NOT NULL
                     AND r_item.order_qty_base > 0
                    THEN (r_item.order_qty_base / r_item.order_qty_display)
                    ELSE NULL
                END,
                NULLIF(r_item.conversion_factor_snapshot, 0),
                NULLIF(r_item.sdi_packaging_qty_in_base, 0),
                NULLIF(r_item.item_default_packaging_qty_in_base, 0),
                1
            );

            v_qty_base := COALESCE(r_item.qty_loaded, 0) * v_factor;

            IF NOT EXISTS (
                SELECT 1 FROM public.inventory_movements
                WHERE reference_type = 'delivery_item'
                  AND reference_id = r_item.id
                  AND movement_type = 'SAIDA'
            ) THEN
                INSERT INTO public.inventory_movements (
                    company_id,
                    item_id,
                    movement_type,
                    qty_base,
                    reference_type,
                    reference_id,
                    source_ref,
                    notes,
                    created_by,
                    created_at,
                    updated_at,
                    occurred_at,
                    reason,
                    qty_in,
                    qty_out,
                    unit_cost,
                    total_cost
                ) VALUES (
                    r_delivery.company_id,
                    r_item.item_id,
                    'SAIDA',
                    -1 * v_qty_base,
                    'delivery_item',
                    r_item.id,
                    v_source_ref,
                    'Baixa por entrega em rota (DRE)',
                    v_created_by_safe,
                    NOW(),
                    NOW(),
                    NOW(),
                    'sales_delivery',
                    0,
                    v_qty_base,
                    v_unit_cost,
                    v_qty_base * v_unit_cost
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

WITH expected AS (
    SELECT
        im.id AS movement_id,
        (
            COALESCE(di.qty_loaded, 0) * COALESCE(
                CASE
                    WHEN COALESCE(sdi.quantity, 0) > 0
                     AND sdi.qty_base IS NOT NULL
                     AND sdi.qty_base > 0
                    THEN (sdi.qty_base / sdi.quantity)
                    ELSE NULL
                END,
                NULLIF(sdi.conversion_factor_snapshot, 0),
                NULLIF(pkg_sdi.qty_in_base, 0),
                NULLIF(pkg_item.qty_in_base, 0),
                1
            )
        )::numeric AS expected_qty_base
    FROM public.inventory_movements im
    JOIN public.delivery_items di
      ON im.reference_type = 'delivery_item'
     AND im.reference_id = di.id
    JOIN public.sales_document_items sdi
      ON sdi.id = di.sales_document_item_id
    LEFT JOIN public.items i
      ON i.id = sdi.item_id
    LEFT JOIN public.item_packaging pkg_sdi
      ON pkg_sdi.id = sdi.packaging_id
    LEFT JOIN public.item_packaging pkg_item
      ON pkg_item.id = i.packaging_id
    WHERE im.movement_type = 'SAIDA'
)
UPDATE public.inventory_movements im
SET
    qty_base = -1 * e.expected_qty_base,
    qty_out = e.expected_qty_base,
    total_cost = COALESCE(im.unit_cost, 0) * e.expected_qty_base,
    updated_at = NOW()
FROM expected e
WHERE im.id = e.movement_id
  AND (
      im.qty_out IS DISTINCT FROM e.expected_qty_base
      OR im.qty_base IS DISTINCT FROM (-1 * e.expected_qty_base)
  );

NOTIFY pgrst, 'reload';

COMMIT;
