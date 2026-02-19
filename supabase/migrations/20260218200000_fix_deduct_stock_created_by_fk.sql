-- Fix: deduct_stock_from_route may fail on inventory_movements_created_by_fkey
-- in environments where inventory_movements.created_by references public.user_profiles(auth_user_id).
-- Strategy: detect current FK target and only persist created_by when candidate is valid.

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
BEGIN
    -- Resolve tenant from route and validate access
    SELECT dr.company_id
      INTO v_company_id
      FROM public.delivery_routes dr
     WHERE dr.id = p_route_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Route not found' USING errcode = 'P0002';
    END IF;

    -- For authenticated calls, enforce tenant membership and prevent user-id spoofing
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

    -- Detect current FK target for inventory_movements.created_by
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
            IF EXISTS (
                SELECT 1
                  FROM public.user_profiles up
                 WHERE up.auth_user_id = v_created_by_candidate
            ) THEN
                v_created_by_safe := v_created_by_candidate;
            END IF;
        ELSIF v_created_by_fk_target = 'auth.users' THEN
            IF EXISTS (
                SELECT 1
                  FROM auth.users au
                 WHERE au.id = v_created_by_candidate
            ) THEN
                v_created_by_safe := v_created_by_candidate;
            END IF;
        END IF;
    END IF;

    FOR r_delivery IN
        SELECT * FROM public.deliveries WHERE route_id = p_route_id
    LOOP
        v_source_ref := concat('Entrega #', r_delivery.number);

        FOR r_item IN
            SELECT di.*, sdi.item_id, i.avg_cost
              FROM public.delivery_items di
              JOIN public.sales_document_items sdi ON sdi.id = di.sales_document_item_id
              LEFT JOIN public.items i ON sdi.item_id = i.id
             WHERE di.delivery_id = r_delivery.id
        LOOP
            v_unit_cost := COALESCE(r_item.avg_cost, 0);

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
                    -1 * r_item.qty_loaded,
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
                    r_item.qty_loaded,
                    v_unit_cost,
                    r_item.qty_loaded * v_unit_cost
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_stock_from_route(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deduct_stock_from_route(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.deduct_stock_from_route(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_stock_from_route(UUID, UUID) TO service_role;

NOTIFY pgrst, 'reload';

COMMIT;
