-- FASE 1 - RPC transacional para set de allocations por parcela

CREATE OR REPLACE FUNCTION public.set_ar_installment_allocations(
    p_installment_id uuid,
    p_allocations jsonb
)
RETURNS TABLE (
    id uuid,
    ar_installment_id uuid,
    gl_account_id uuid,
    cost_center_id uuid,
    amount numeric(14,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id uuid;
    v_target_amount numeric(14,2);
    v_sum numeric(14,2);
BEGIN
    SELECT company_id, amount_original::numeric(14,2)
      INTO v_company_id, v_target_amount
      FROM public.ar_installments
     WHERE id = p_installment_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Parcela AR não encontrada: %', p_installment_id;
    END IF;

    IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) = 0 THEN
        RAISE EXCEPTION 'Lista de allocations inválida';
    END IF;

    WITH parsed AS (
        SELECT
            (entry->>'gl_account_id')::uuid AS gl_account_id,
            NULLIF(entry->>'cost_center_id', '')::uuid AS cost_center_id,
            (entry->>'amount')::numeric(14,2) AS amount
        FROM jsonb_array_elements(p_allocations) entry
    )
    SELECT COALESCE(SUM(amount), 0)
      INTO v_sum
      FROM parsed;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_allocations) entry
        WHERE COALESCE((entry->>'amount')::numeric, 0) <= 0
    ) THEN
        RAISE EXCEPTION 'Allocation com amount inválido';
    END IF;

    IF ROUND(v_sum::numeric, 2) <> ROUND(v_target_amount::numeric, 2) THEN
        RAISE EXCEPTION 'Soma do rateio (%) difere da parcela (%)', v_sum, v_target_amount;
    END IF;

    DELETE FROM public.ar_installment_allocations
     WHERE ar_installment_id = p_installment_id;

    INSERT INTO public.ar_installment_allocations (
        company_id,
        ar_installment_id,
        gl_account_id,
        cost_center_id,
        amount
    )
    SELECT
        v_company_id,
        p_installment_id,
        (entry->>'gl_account_id')::uuid,
        NULLIF(entry->>'cost_center_id', '')::uuid,
        (entry->>'amount')::numeric(14,2)
    FROM jsonb_array_elements(p_allocations) entry;

    RETURN QUERY
    SELECT
        allocation.id,
        allocation.ar_installment_id,
        allocation.gl_account_id,
        allocation.cost_center_id,
        allocation.amount::numeric(14,2)
    FROM public.ar_installment_allocations allocation
    WHERE allocation.ar_installment_id = p_installment_id
    ORDER BY allocation.gl_account_id, allocation.cost_center_id NULLS FIRST;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_ap_installment_allocations(
    p_installment_id uuid,
    p_allocations jsonb
)
RETURNS TABLE (
    id uuid,
    ap_installment_id uuid,
    gl_account_id uuid,
    cost_center_id uuid,
    amount numeric(14,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id uuid;
    v_target_amount numeric(14,2);
    v_sum numeric(14,2);
BEGIN
    SELECT company_id, amount_original::numeric(14,2)
      INTO v_company_id, v_target_amount
      FROM public.ap_installments
     WHERE id = p_installment_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Parcela AP não encontrada: %', p_installment_id;
    END IF;

    IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) = 0 THEN
        RAISE EXCEPTION 'Lista de allocations inválida';
    END IF;

    WITH parsed AS (
        SELECT
            (entry->>'gl_account_id')::uuid AS gl_account_id,
            NULLIF(entry->>'cost_center_id', '')::uuid AS cost_center_id,
            (entry->>'amount')::numeric(14,2) AS amount
        FROM jsonb_array_elements(p_allocations) entry
    )
    SELECT COALESCE(SUM(amount), 0)
      INTO v_sum
      FROM parsed;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_allocations) entry
        WHERE COALESCE((entry->>'amount')::numeric, 0) <= 0
    ) THEN
        RAISE EXCEPTION 'Allocation com amount inválido';
    END IF;

    IF ROUND(v_sum::numeric, 2) <> ROUND(v_target_amount::numeric, 2) THEN
        RAISE EXCEPTION 'Soma do rateio (%) difere da parcela (%)', v_sum, v_target_amount;
    END IF;

    DELETE FROM public.ap_installment_allocations
     WHERE ap_installment_id = p_installment_id;

    INSERT INTO public.ap_installment_allocations (
        company_id,
        ap_installment_id,
        gl_account_id,
        cost_center_id,
        amount
    )
    SELECT
        v_company_id,
        p_installment_id,
        (entry->>'gl_account_id')::uuid,
        NULLIF(entry->>'cost_center_id', '')::uuid,
        (entry->>'amount')::numeric(14,2)
    FROM jsonb_array_elements(p_allocations) entry;

    RETURN QUERY
    SELECT
        allocation.id,
        allocation.ap_installment_id,
        allocation.gl_account_id,
        allocation.cost_center_id,
        allocation.amount::numeric(14,2)
    FROM public.ap_installment_allocations allocation
    WHERE allocation.ap_installment_id = p_installment_id
    ORDER BY allocation.gl_account_id, allocation.cost_center_id NULLS FIRST;
END;
$$;

REVOKE ALL ON FUNCTION public.set_ar_installment_allocations(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ar_installment_allocations(uuid, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_ap_installment_allocations(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ap_installment_allocations(uuid, jsonb) TO authenticated, service_role;
