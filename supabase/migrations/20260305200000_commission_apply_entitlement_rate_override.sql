-- =====================================================
-- RPC: override de taxa de comissão por item (entitlement)
-- Escopo: altera apenas o item selecionado e seus releases em aberto
-- =====================================================

CREATE OR REPLACE FUNCTION public.commission_apply_entitlement_rate_override(
    p_company_id UUID,
    p_entitlement_id UUID,
    p_new_rate NUMERIC,
    p_reason TEXT,
    p_changed_by UUID,
    p_source_context TEXT
)
RETURNS TABLE (
    entitlement_id UUID,
    order_id UUID,
    old_rate NUMERIC,
    new_rate NUMERIC,
    open_releases_count INTEGER,
    adjustment_delta NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entitlement RECORD;
    v_old_rate NUMERIC;
    v_new_rate NUMERIC;
    v_delta NUMERIC := 0;
    v_releases_count INTEGER := 0;
    v_source_key TEXT;
BEGIN
    IF p_company_id IS NULL OR p_entitlement_id IS NULL THEN
        RAISE EXCEPTION 'Empresa e item de comissão são obrigatórios.';
    END IF;

    IF p_new_rate IS NULL OR p_new_rate < 0 OR p_new_rate > 100 THEN
        RAISE EXCEPTION 'Nova taxa de comissão inválida.';
    END IF;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'Motivo é obrigatório para alterar comissão.';
    END IF;

    IF NOT public.is_member_of(p_company_id) THEN
        RAISE EXCEPTION 'Acesso negado para empresa %', p_company_id;
    END IF;

    SELECT *
      INTO v_entitlement
    FROM public.commission_entitlements e
    WHERE e.id = p_entitlement_id
      AND e.company_id = p_company_id
      AND e.settlement_id IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item de comissão não encontrado ou já liquidado.';
    END IF;

    v_old_rate := COALESCE(v_entitlement.commission_rate, 0);
    v_new_rate := ROUND(p_new_rate::NUMERIC, 4);

    IF v_old_rate = v_new_rate THEN
        RETURN QUERY
        SELECT p_entitlement_id, v_entitlement.order_id, v_old_rate, v_new_rate, 0, 0::NUMERIC;
        RETURN;
    END IF;

    UPDATE public.commission_entitlements e
       SET commission_rate = v_new_rate,
           commission_total = ROUND((e.base_delivered_amount * (v_new_rate / 100))::NUMERIC, 2),
           updated_at = now()
     WHERE e.id = p_entitlement_id
       AND e.company_id = p_company_id
       AND e.settlement_id IS NULL;

    WITH release_delta AS (
        SELECT
            r.id,
            ROUND((r.base_paid_amount * (v_new_rate / 100))::NUMERIC, 2) AS new_release_amount,
            ROUND((ROUND((r.base_paid_amount * (v_new_rate / 100))::NUMERIC, 2) - r.commission_released_amount)::NUMERIC, 2) AS delta
        FROM public.commission_releases r
        WHERE r.company_id = p_company_id
          AND r.entitlement_id = p_entitlement_id
          AND r.settlement_id IS NULL
    ),
    release_update AS (
        UPDATE public.commission_releases r
           SET commission_released_amount = rd.new_release_amount,
               updated_at = now()
          FROM release_delta rd
         WHERE r.id = rd.id
        RETURNING rd.delta
    )
    SELECT
        COALESCE(COUNT(*), 0)::INTEGER,
        COALESCE(ROUND(SUM(delta)::NUMERIC, 2), 0)
      INTO v_releases_count, v_delta
    FROM release_update;

    v_source_key := 'rate_override_item:' || p_entitlement_id::TEXT || ':' || COALESCE(NULLIF(btrim(p_source_context), ''), 'finance_commissions_item');

    IF v_delta <> 0 THEN
        INSERT INTO public.rep_commission_ledger (
            company_id,
            rep_id,
            entry_type,
            amount,
            source_key,
            notes,
            created_by
        ) VALUES (
            p_company_id,
            v_entitlement.rep_id,
            'ADJUSTMENT',
            v_delta,
            v_source_key,
            'Ajuste de comissão por alteração de taxa no item de entrega ' || COALESCE(v_entitlement.delivery_id::TEXT, p_entitlement_id::TEXT) || ' (pedido ' || COALESCE(v_entitlement.order_id::TEXT, '-') || ')',
            COALESCE(p_changed_by, auth.uid())
        )
        ON CONFLICT (company_id, source_key)
        DO NOTHING;
    END IF;

    RETURN QUERY
    SELECT
        p_entitlement_id,
        v_entitlement.order_id,
        v_old_rate,
        v_new_rate,
        v_releases_count,
        v_delta;
END;
$$;

GRANT EXECUTE ON FUNCTION public.commission_apply_entitlement_rate_override(UUID, UUID, NUMERIC, TEXT, UUID, TEXT) TO authenticated;
