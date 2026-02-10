-- Fix stock deduction to always use base units, even when order item uses packaging
-- Keeps hardened tenant/security checks from previous function version.

BEGIN;

CREATE OR REPLACE FUNCTION public.deduct_stock_from_route(p_route_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id uuid;
    v_created_by uuid;
    r_delivery RECORD;
    r_item RECORD;
    v_source_ref TEXT;
    v_unit_cost NUMERIC;
    v_qty_base_abs NUMERIC;
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

    v_created_by := COALESCE(auth.uid(), p_user_id);

    FOR r_delivery IN
        SELECT * FROM public.deliveries WHERE route_id = p_route_id
    LOOP
        v_source_ref := concat('Entrega #', r_delivery.number);

        FOR r_item IN
            SELECT
                di.*,
                sdi.item_id,
                COALESCE(sdi.qty_base, di.qty_loaded) AS qty_base_candidate,
                COALESCE(i.avg_cost, 0) AS avg_cost
              FROM public.delivery_items di
              JOIN public.sales_document_items sdi ON sdi.id = di.sales_document_item_id
              LEFT JOIN public.items i ON sdi.item_id = i.id
             WHERE di.delivery_id = r_delivery.id
        LOOP
            v_unit_cost := COALESCE(r_item.avg_cost, 0);
            v_qty_base_abs := ABS(COALESCE(r_item.qty_base_candidate, 0));

            IF v_qty_base_abs <= 0 THEN
                CONTINUE;
            END IF;

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
                    -1 * v_qty_base_abs,
                    'delivery_item',
                    r_item.id,
                    v_source_ref,
                    'Baixa por entrega em rota (base units)',
                    v_created_by,
                    NOW(),
                    NOW(),
                    NOW(),
                    'sales_delivery',
                    0,
                    v_qty_base_abs,
                    v_unit_cost,
                    v_qty_base_abs * v_unit_cost
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
