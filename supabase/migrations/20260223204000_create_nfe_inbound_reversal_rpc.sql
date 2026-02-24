-- RPC: criar solicitação de NF-e de Entrada (Estorno) a partir de uma NF-e de Saída autorizada.
-- A função é chamada apenas pelo backend (service_role) e executa de forma atômica:
-- 1) valida NF-e de saída (nfe_emissions)
-- 2) grava solicitação em nfe_inbound_reversals
-- 3) enfileira job NFE_INBOUND_REVERSAL_EMIT
-- 4) grava audit_log

BEGIN;

CREATE OR REPLACE FUNCTION public.create_inbound_reversal_request(
    p_company_id uuid,
    p_outbound_emission_id uuid,
    p_payload jsonb,
    p_created_by uuid DEFAULT NULL
)
RETURNS TABLE (
    reversal_id uuid,
    job_id uuid,
    existing boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_outbound record;
    v_outbound_key text;
    v_existing_id uuid;
    v_mode text;
    v_reason_code text;
    v_reason_other text;
    v_internal_notes text;
    v_selection jsonb;
BEGIN
    IF p_company_id IS NULL OR p_outbound_emission_id IS NULL THEN
        RAISE EXCEPTION 'company_id e outbound_emission_id são obrigatórios';
    END IF;

    SELECT id, company_id, access_key, sales_document_id, status
      INTO v_outbound
    FROM public.nfe_emissions
    WHERE id = p_outbound_emission_id
      AND company_id = p_company_id
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NF-e de saída não encontrada para a empresa informada';
    END IF;

    IF COALESCE(v_outbound.status, '') <> 'authorized' THEN
        RAISE EXCEPTION 'A NF-e de saída precisa estar AUTORIZADA para gerar estorno (status atual: %)', v_outbound.status;
    END IF;

    v_outbound_key := v_outbound.access_key;
    IF v_outbound_key IS NULL OR length(v_outbound_key) <> 44 THEN
        RAISE EXCEPTION 'Chave de acesso inválida/ausente na NF-e de saída';
    END IF;

    SELECT nir.id
      INTO v_existing_id
    FROM public.nfe_inbound_reversals nir
    WHERE nir.company_id = p_company_id
      AND nir.outbound_access_key = v_outbound_key
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        reversal_id := v_existing_id;
        job_id := NULL;
        existing := TRUE;
        RETURN NEXT;
        RETURN;
    END IF;

    v_mode := COALESCE(NULLIF(btrim(p_payload->>'mode'), ''), 'TOTAL');
    IF v_mode NOT IN ('TOTAL', 'PARCIAL') THEN
        RAISE EXCEPTION 'mode inválido (use TOTAL ou PARCIAL)';
    END IF;

    v_reason_code := COALESCE(NULLIF(btrim(p_payload->>'reason_code'), ''), '');
    IF v_reason_code = '' THEN
        RAISE EXCEPTION 'reason_code é obrigatório';
    END IF;

    v_reason_other := NULLIF(btrim(p_payload->>'reason_other'), '');
    v_internal_notes := NULLIF(btrim(p_payload->>'internal_notes'), '');
    v_selection := COALESCE(p_payload->'selection', '[]'::jsonb);

    IF v_mode = 'PARCIAL' THEN
        IF jsonb_typeof(v_selection) <> 'array' OR jsonb_array_length(v_selection) = 0 THEN
            RAISE EXCEPTION 'Para estorno parcial, selecione ao menos 1 item com quantidade > 0';
        END IF;
    END IF;

    INSERT INTO public.nfe_inbound_reversals (
        company_id,
        outbound_emission_id,
        outbound_access_key,
        outbound_sales_document_id,
        mode,
        reason_code,
        reason_other,
        internal_notes,
        selection,
        status,
        created_by
    ) VALUES (
        p_company_id,
        p_outbound_emission_id,
        v_outbound_key,
        v_outbound.sales_document_id,
        v_mode,
        v_reason_code,
        v_reason_other,
        v_internal_notes,
        v_selection,
        'pending',
        p_created_by
    )
    RETURNING id INTO reversal_id;

    INSERT INTO public.jobs_queue (job_type, payload, status)
    VALUES (
        'NFE_INBOUND_REVERSAL_EMIT',
        jsonb_build_object(
            'reversalId', reversal_id,
            'companyId', p_company_id
        ),
        'pending'
    )
    RETURNING id INTO job_id;

    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        action,
        resource,
        entity_type,
        entity_id,
        details
    ) VALUES (
        p_company_id,
        p_created_by,
        'NFE_ENTRADA_ESTORNO_SOLICITADA',
        'nfe',
        'nfe_inbound_reversal',
        reversal_id,
        jsonb_build_object(
            'outbound_emission_id', p_outbound_emission_id,
            'outbound_access_key', v_outbound_key,
            'mode', v_mode,
            'reason_code', v_reason_code
        )
    );

    existing := FALSE;
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_inbound_reversal_request(uuid, uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_inbound_reversal_request(uuid, uuid, jsonb, uuid) TO service_role;

COMMIT;

