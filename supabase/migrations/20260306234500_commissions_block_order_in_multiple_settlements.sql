BEGIN;

CREATE INDEX IF NOT EXISTS commission_settlement_items_item_lookup_idx
    ON public.commission_settlement_items (item_type, item_id);

CREATE OR REPLACE FUNCTION public.commission_settlement_item_order_id(
    p_item_type TEXT,
    p_item_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
BEGIN
    IF p_item_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF UPPER(COALESCE(p_item_type, '')) = 'RELEASE' THEN
        SELECT r.order_id
          INTO v_order_id
          FROM public.commission_releases r
         WHERE r.id = p_item_id;
    ELSIF UPPER(COALESCE(p_item_type, '')) = 'ENTITLEMENT' THEN
        SELECT e.order_id
          INTO v_order_id
          FROM public.commission_entitlements e
         WHERE e.id = p_item_id;
    ELSE
        RETURN NULL;
    END IF;

    RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.commission_settlement_item_order_id(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.commission_validate_order_single_active_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_order_id UUID;
    v_order_number BIGINT;
    v_conflict_settlement_id UUID;
    v_conflict_document_number BIGINT;
BEGIN
    SELECT s.company_id
      INTO v_company_id
      FROM public.commission_settlements s
     WHERE s.id = NEW.settlement_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Acerto de comissão inválido para item selecionado.';
    END IF;

    v_order_id := public.commission_settlement_item_order_id(NEW.item_type, NEW.item_id);
    IF v_order_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT sd.document_number
      INTO v_order_number
      FROM public.sales_documents sd
     WHERE sd.id = v_order_id
       AND sd.company_id = v_company_id;

    SELECT s.id, s.document_number
      INTO v_conflict_settlement_id, v_conflict_document_number
      FROM public.commission_settlement_items csi
      JOIN public.commission_settlements s
        ON s.id = csi.settlement_id
     WHERE s.company_id = v_company_id
       AND s.status IN ('RASCUNHO', 'CONFIRMADO')
       AND csi.settlement_id <> NEW.settlement_id
       AND public.commission_settlement_item_order_id(csi.item_type, csi.item_id) = v_order_id
     LIMIT 1;

    IF v_conflict_settlement_id IS NOT NULL THEN
        RAISE EXCEPTION
            'Pedido #% já está vinculado ao acerto #%.',
            COALESCE(v_order_number::TEXT, substring(v_order_id::TEXT, 1, 8)),
            COALESCE(v_conflict_document_number::TEXT, substring(v_conflict_settlement_id::TEXT, 1, 8))
            USING ERRCODE = '23505';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commission_single_active_settlement_order ON public.commission_settlement_items;
CREATE TRIGGER trg_commission_single_active_settlement_order
    BEFORE INSERT OR UPDATE ON public.commission_settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.commission_validate_order_single_active_settlement();

CREATE OR REPLACE FUNCTION public.commission_get_rep_open_items(
    p_company_id UUID,
    p_rep_id UUID,
    p_cutoff_date DATE
)
RETURNS TABLE (
    entitlement_id UUID,
    order_id UUID,
    order_number BIGINT,
    customer_id UUID,
    customer_name TEXT,
    delivery_item_id UUID,
    delivered_date DATE,
    status_logistico TEXT,
    status_financeiro TEXT,
    base_delivered_amount NUMERIC,
    commission_rate NUMERIC,
    commission_total NUMERIC,
    released_open_amount NUMERIC,
    unreleased_open_amount NUMERIC,
    total_open_amount NUMERIC,
    max_payable_amount NUMERIC,
    release_item_ids JSONB,
    default_selected BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_company_id IS NULL OR p_rep_id IS NULL THEN
        RAISE EXCEPTION 'Empresa e representante são obrigatórios.';
    END IF;

    IF NOT public.is_member_of(p_company_id) THEN
        RAISE EXCEPTION 'Acesso negado para empresa %', p_company_id;
    END IF;

    PERFORM public.commission_refresh_rep_open_state(p_company_id, p_rep_id, p_cutoff_date);

    RETURN QUERY
    WITH release_open AS (
        SELECT
            r.entitlement_id,
            ROUND(SUM(r.commission_released_amount)::NUMERIC, 2) AS released_open_amount,
            jsonb_agg(r.id ORDER BY r.created_at) AS release_item_ids
        FROM public.commission_releases r
        WHERE r.company_id = p_company_id
          AND r.rep_id = p_rep_id
          AND r.settlement_id IS NULL
        GROUP BY r.entitlement_id
    ),
    release_total AS (
        SELECT
            r.entitlement_id,
            ROUND(SUM(r.commission_released_amount)::NUMERIC, 2) AS released_total_amount
        FROM public.commission_releases r
        WHERE r.company_id = p_company_id
          AND r.rep_id = p_rep_id
        GROUP BY r.entitlement_id
    )
    SELECT
        e.id AS entitlement_id,
        e.order_id,
        sd.document_number::BIGINT AS order_number,
        sd.client_id AS customer_id,
        COALESCE(org.trade_name, org.legal_name, 'Cliente sem nome') AS customer_name,
        e.delivery_id AS delivery_item_id,
        COALESCE(d.created_at::DATE, p_cutoff_date) AS delivered_date,
        COALESCE(sd.status_logistic::TEXT, 'pending') AS status_logistico,
        COALESCE(sd.financial_status::TEXT, 'pending') AS status_financeiro,
        e.base_delivered_amount,
        e.commission_rate,
        e.commission_total,
        COALESCE(ro.released_open_amount, 0) AS released_open_amount,
        ROUND(GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0)::NUMERIC, 2) AS unreleased_open_amount,
        ROUND((COALESCE(ro.released_open_amount, 0) + GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0))::NUMERIC, 2) AS total_open_amount,
        ROUND((COALESCE(ro.released_open_amount, 0) + GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0))::NUMERIC, 2) AS max_payable_amount,
        COALESCE(ro.release_item_ids, '[]'::JSONB) AS release_item_ids,
        (COALESCE(ro.released_open_amount, 0) > 0) AS default_selected
    FROM public.commission_entitlements e
    INNER JOIN public.sales_documents sd
        ON sd.id = e.order_id
       AND sd.company_id = e.company_id
    INNER JOIN public.delivery_items di
        ON di.id = e.delivery_id
       AND di.company_id = e.company_id
    INNER JOIN public.deliveries d
        ON d.id = di.delivery_id
       AND d.company_id = e.company_id
    LEFT JOIN public.organizations org
        ON org.id = sd.client_id
    LEFT JOIN release_open ro
        ON ro.entitlement_id = e.id
    LEFT JOIN release_total rt
        ON rt.entitlement_id = e.id
    WHERE e.company_id = p_company_id
      AND e.rep_id = p_rep_id
      AND e.settlement_id IS NULL
      AND (COALESCE(ro.released_open_amount, 0) > 0 OR GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0) > 0)
      AND NOT EXISTS (
          SELECT 1
          FROM public.commission_settlement_items csi
          JOIN public.commission_settlements cs
            ON cs.id = csi.settlement_id
          WHERE cs.company_id = p_company_id
            AND cs.status IN ('RASCUNHO', 'CONFIRMADO')
            AND public.commission_settlement_item_order_id(csi.item_type, csi.item_id) = e.order_id
      )
    ORDER BY sd.document_number DESC, customer_name ASC, e.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.commission_get_rep_open_items(UUID, UUID, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
