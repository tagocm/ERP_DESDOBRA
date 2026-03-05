-- Canonical production posting function (transactional + idempotent)

ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;
ALTER TABLE public.inventory_movements
    ADD CONSTRAINT inventory_movements_movement_type_check
    CHECK (
        movement_type IN (
            'ENTRADA',
            'SAIDA',
            'AJUSTE',
            'PRODUCTION_CONSUMPTION',
            'PRODUCTION_OUTPUT',
            'PRODUCTION_BYPRODUCT_OUTPUT'
        )
    );

CREATE OR REPLACE FUNCTION public.post_work_order_entry(
    p_company_id UUID,
    p_work_order_id UUID,
    p_occurred_at TIMESTAMPTZ,
    p_produced_qty NUMERIC,
    p_executed_batches INTEGER,
    p_divergence_type TEXT,
    p_notes TEXT,
    p_created_by UUID,
    p_idempotency_key TEXT,
    p_mark_done BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    posted BOOLEAN,
    work_order_status TEXT,
    produced_total NUMERIC,
    expected_output_qty NUMERIC,
    loss_qty NUMERIC,
    created_movement_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_work_order RECORD;
    v_work_order_status TEXT;
    v_work_order_produced_total NUMERIC;
    v_yield_qty NUMERIC;
    v_expected_output_qty NUMERIC;
    v_loss_qty NUMERIC;
    v_divergence_type TEXT;
    v_source_ref TEXT;
    v_created_by UUID;
    v_consumed_qty NUMERIC;
    v_byproduct_qty NUMERIC;
    v_component RECORD;
    v_byproduct RECORD;
    v_created_count INTEGER := 0;
BEGIN
    IF p_company_id IS NULL OR p_work_order_id IS NULL THEN
        RAISE EXCEPTION 'Empresa e OP são obrigatórias.';
    END IF;

    IF p_produced_qty IS NULL OR p_produced_qty <= 0 THEN
        RAISE EXCEPTION 'Quantidade produzida deve ser maior que zero.';
    END IF;

    IF p_executed_batches IS NULL OR p_executed_batches <= 0 THEN
        RAISE EXCEPTION 'Receitas executadas deve ser maior que zero.';
    END IF;

    IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    v_divergence_type := upper(coalesce(p_divergence_type, 'PARTIAL_EXECUTION'));
    IF v_divergence_type NOT IN ('PARTIAL_EXECUTION', 'LOW_YIELD') THEN
        RAISE EXCEPTION 'Tipo de divergência inválido.';
    END IF;

    v_source_ref := 'production_entry:' || p_idempotency_key;
    v_created_by := coalesce(auth.uid(), p_created_by);

    PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text || ':' || p_idempotency_key));

    IF EXISTS (
        SELECT 1
        FROM public.inventory_movements im
        WHERE im.company_id = p_company_id
          AND im.source_ref = v_source_ref
    ) THEN
        SELECT wo.status, wo.produced_qty
          INTO v_work_order_status, v_work_order_produced_total
        FROM public.work_orders wo
        WHERE wo.company_id = p_company_id
          AND wo.id = p_work_order_id
          AND wo.deleted_at IS NULL;

        RETURN QUERY
        SELECT
            FALSE,
            coalesce(v_work_order_status, 'planned')::TEXT,
            coalesce(v_work_order_produced_total, 0)::NUMERIC,
            0::NUMERIC,
            0::NUMERIC,
            0::INTEGER;
        RETURN;
    END IF;

    SELECT wo.*
      INTO v_work_order
    FROM public.work_orders wo
    WHERE wo.company_id = p_company_id
      AND wo.id = p_work_order_id
      AND wo.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ordem de produção não encontrada.';
    END IF;

    IF v_work_order.status = 'cancelled' THEN
        RAISE EXCEPTION 'Não é possível apontar ordem cancelada.';
    END IF;

    IF v_work_order.status = 'done' AND NOT p_mark_done THEN
        RAISE EXCEPTION 'Não é possível apontar ordem encerrada.';
    END IF;

    IF v_work_order.bom_id IS NULL THEN
        RAISE EXCEPTION 'OP sem BOM vinculada.';
    END IF;

    SELECT bh.yield_qty
      INTO v_yield_qty
    FROM public.bom_headers bh
    WHERE bh.company_id = p_company_id
      AND bh.id = v_work_order.bom_id
      AND bh.deleted_at IS NULL;

    IF v_yield_qty IS NULL OR v_yield_qty <= 0 THEN
        v_yield_qty := 1;
    END IF;

    v_expected_output_qty := p_executed_batches * v_yield_qty;
    v_loss_qty := CASE
        WHEN v_divergence_type = 'LOW_YIELD' THEN greatest(0, v_expected_output_qty - p_produced_qty)
        ELSE 0
    END;

    FOR v_component IN
        SELECT bl.component_item_id, bl.qty, coalesce(bl.loss_percent, 0) AS loss_percent
        FROM public.bom_lines bl
        WHERE bl.company_id = p_company_id
          AND bl.bom_id = v_work_order.bom_id
    LOOP
        v_consumed_qty := (v_component.qty * p_executed_batches) * (1 + (v_component.loss_percent / 100));

        IF v_consumed_qty > 0 THEN
            INSERT INTO public.inventory_movements (
                company_id,
                item_id,
                movement_type,
                qty_base,
                qty_in,
                qty_out,
                reason,
                reference_type,
                reference_id,
                source_ref,
                occurred_at,
                notes,
                created_by
            ) VALUES (
                p_company_id,
                v_component.component_item_id,
                'PRODUCTION_CONSUMPTION',
                -1 * v_consumed_qty,
                0,
                v_consumed_qty,
                'production_out',
                'work_order',
                p_work_order_id,
                v_source_ref,
                p_occurred_at,
                coalesce(p_notes, 'Consumo por apontamento de produção'),
                v_created_by
            );
            v_created_count := v_created_count + 1;
        END IF;
    END LOOP;

    INSERT INTO public.inventory_movements (
        company_id,
        item_id,
        movement_type,
        qty_base,
        qty_in,
        qty_out,
        reason,
        reference_type,
        reference_id,
        source_ref,
        occurred_at,
        notes,
        created_by
    ) VALUES (
        p_company_id,
        v_work_order.item_id,
        'PRODUCTION_OUTPUT',
        p_produced_qty,
        p_produced_qty,
        0,
        'production_in',
        'work_order',
        p_work_order_id,
        v_source_ref,
        p_occurred_at,
        coalesce(p_notes, 'Apontamento de produção'),
        v_created_by
    );
    v_created_count := v_created_count + 1;

    FOR v_byproduct IN
        SELECT bpo.item_id, bpo.qty, bpo.basis
        FROM public.bom_byproduct_outputs bpo
        WHERE bpo.company_id = p_company_id
          AND bpo.bom_id = v_work_order.bom_id
    LOOP
        IF v_byproduct.basis = 'PERCENT' THEN
            v_byproduct_qty := p_produced_qty * (v_byproduct.qty / 100);
        ELSE
            v_byproduct_qty := v_byproduct.qty * p_executed_batches;
        END IF;

        IF v_byproduct_qty > 0 THEN
            INSERT INTO public.inventory_movements (
                company_id,
                item_id,
                movement_type,
                qty_base,
                qty_in,
                qty_out,
                reason,
                reference_type,
                reference_id,
                source_ref,
                occurred_at,
                notes,
                created_by
            ) VALUES (
                p_company_id,
                v_byproduct.item_id,
                'PRODUCTION_BYPRODUCT_OUTPUT',
                v_byproduct_qty,
                v_byproduct_qty,
                0,
                'production_byproduct_in',
                'work_order',
                p_work_order_id,
                v_source_ref,
                p_occurred_at,
                coalesce(p_notes, 'Co-produto por apontamento de produção'),
                v_created_by
            );
            v_created_count := v_created_count + 1;
        END IF;
    END LOOP;

    UPDATE public.work_orders wo
       SET produced_qty = coalesce(wo.produced_qty, 0) + p_produced_qty,
           status = CASE
                WHEN p_mark_done THEN 'done'
                WHEN wo.status = 'planned' THEN 'in_progress'
                ELSE wo.status
           END,
           started_at = CASE
                WHEN wo.started_at IS NULL AND wo.status = 'planned' THEN p_occurred_at
                ELSE wo.started_at
           END,
           finished_at = CASE
                WHEN p_mark_done THEN coalesce(wo.finished_at, p_occurred_at)
                ELSE wo.finished_at
           END,
           updated_at = now()
     WHERE wo.company_id = p_company_id
       AND wo.id = p_work_order_id;

    SELECT wo.status, wo.produced_qty
      INTO v_work_order_status, v_work_order_produced_total
    FROM public.work_orders wo
    WHERE wo.company_id = p_company_id
      AND wo.id = p_work_order_id;

    RETURN QUERY
    SELECT
        TRUE,
        v_work_order_status::TEXT,
        coalesce(v_work_order_produced_total, 0)::NUMERIC,
        v_expected_output_qty::NUMERIC,
        v_loss_qty::NUMERIC,
        v_created_count::INTEGER;
END;
$$;

REVOKE ALL ON FUNCTION public.post_work_order_entry(UUID, UUID, TIMESTAMPTZ, NUMERIC, INTEGER, TEXT, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_work_order_entry(UUID, UUID, TIMESTAMPTZ, NUMERIC, INTEGER, TEXT, TEXT, UUID, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.post_work_order_entry(UUID, UUID, TIMESTAMPTZ, NUMERIC, INTEGER, TEXT, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_work_order_entry(UUID, UUID, TIMESTAMPTZ, NUMERIC, INTEGER, TEXT, TEXT, UUID, TEXT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.register_production_entry(
    p_work_order_id UUID,
    p_qty_produced NUMERIC,
    p_occurred_at TIMESTAMPTZ,
    p_notes TEXT
)
RETURNS VOID AS $$
DECLARE
    v_company_id UUID;
    v_yield_qty NUMERIC;
    v_executed_batches INTEGER;
    v_idempotency_key TEXT;
BEGIN
    SELECT wo.company_id, coalesce(bh.yield_qty, 1)
      INTO v_company_id, v_yield_qty
    FROM public.work_orders wo
    LEFT JOIN public.bom_headers bh ON bh.id = wo.bom_id
    WHERE wo.id = p_work_order_id
      AND wo.deleted_at IS NULL;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Work Order not found';
    END IF;

    IF v_yield_qty <= 0 THEN
        v_yield_qty := 1;
    END IF;

    v_executed_batches := greatest(1, ceil(p_qty_produced / v_yield_qty)::INTEGER);
    v_idempotency_key := md5(concat('legacy-rpc:', p_work_order_id::TEXT, ':', p_qty_produced::TEXT, ':', p_occurred_at::TEXT));

    PERFORM public.post_work_order_entry(
        v_company_id,
        p_work_order_id,
        p_occurred_at,
        p_qty_produced,
        v_executed_batches,
        'PARTIAL_EXECUTION',
        p_notes,
        auth.uid(),
        v_idempotency_key,
        FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.register_production_entry(UUID, NUMERIC, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_production_entry(UUID, NUMERIC, TIMESTAMPTZ, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_production_entry(UUID, NUMERIC, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_production_entry(UUID, NUMERIC, TIMESTAMPTZ, TEXT) TO service_role;
