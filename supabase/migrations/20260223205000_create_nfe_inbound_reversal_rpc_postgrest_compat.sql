-- Compat: PostgREST resolve funções por assinatura (ordem/tipos). Em chamadas RPC via JSON,
-- ele pode procurar a assinatura com argumentos em ordem alfabética de chave.
-- Esta overload garante que a chamada encontre a função, e delega para a implementação existente.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_inbound_reversal_request(
    p_company_id uuid,
    p_created_by uuid,
    p_outbound_emission_id uuid,
    p_payload jsonb
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
BEGIN
    -- Delegate to the implementation overload (uuid, uuid, jsonb, uuid) by position.
    RETURN QUERY
    SELECT *
    FROM public.create_inbound_reversal_request(
        p_company_id,
        p_outbound_emission_id,
        p_payload,
        p_created_by
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_inbound_reversal_request(uuid, uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_inbound_reversal_request(uuid, uuid, uuid, jsonb) TO service_role;

COMMIT;

