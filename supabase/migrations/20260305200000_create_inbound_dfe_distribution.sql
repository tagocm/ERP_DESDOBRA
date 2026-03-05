BEGIN;

CREATE TABLE IF NOT EXISTS public.fiscal_dfe_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    environment TEXT NOT NULL CHECK (environment IN ('production', 'homologation')),
    last_nsu TEXT NOT NULL DEFAULT '0',
    last_sync_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'IDLE' CHECK (status IN ('IDLE', 'RUNNING', 'ERROR')),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fiscal_dfe_sync_state_company_environment UNIQUE (company_id, environment)
);

CREATE TABLE IF NOT EXISTS public.fiscal_inbound_dfe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    environment TEXT NOT NULL CHECK (environment IN ('production', 'homologation')),
    nsu TEXT NOT NULL,
    schema TEXT NOT NULL,
    chnfe TEXT,
    emit_cnpj TEXT,
    emit_nome TEXT,
    dest_cnpj TEXT,
    dh_emi TIMESTAMPTZ,
    total NUMERIC(15, 2),
    summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    xml_base64 TEXT,
    xml_is_gz BOOLEAN NOT NULL DEFAULT FALSE,
    has_full_xml BOOLEAN NOT NULL DEFAULT FALSE,
    manifest_status TEXT NOT NULL DEFAULT 'SEM_MANIFESTACAO' CHECK (manifest_status IN ('SEM_MANIFESTACAO', 'CIENCIA', 'CONFIRMADA', 'DESCONHECIDA', 'NAO_REALIZADA')),
    manifest_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fiscal_inbound_dfe_company_environment_nsu UNIQUE (company_id, environment, nsu),
    CONSTRAINT ck_fiscal_inbound_dfe_chnfe CHECK (chnfe IS NULL OR chnfe ~ '^\\d{44}$'),
    CONSTRAINT ck_fiscal_inbound_dfe_emit_cnpj CHECK (emit_cnpj IS NULL OR emit_cnpj ~ '^\\d{14}$'),
    CONSTRAINT ck_fiscal_inbound_dfe_dest_cnpj CHECK (dest_cnpj IS NULL OR dest_cnpj ~ '^\\d{14}$')
);

CREATE INDEX IF NOT EXISTS idx_fiscal_inbound_dfe_company_environment_chnfe
    ON public.fiscal_inbound_dfe (company_id, environment, chnfe);

CREATE INDEX IF NOT EXISTS idx_fiscal_inbound_dfe_company_environment_dh_emi_desc
    ON public.fiscal_inbound_dfe (company_id, environment, dh_emi DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.fiscal_inbound_manifest_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    environment TEXT NOT NULL CHECK (environment IN ('production', 'homologation')),
    chnfe TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('CIENCIA', 'CONFIRMACAO', 'DESCONHECIMENTO', 'NAO_REALIZADA')),
    justification TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'ERROR')),
    sefaz_receipt TEXT,
    sefaz_protocol TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fiscal_inbound_manifest_events_idempotency UNIQUE (company_id, environment, chnfe, event_type),
    CONSTRAINT ck_fiscal_inbound_manifest_events_chnfe CHECK (chnfe ~ '^\\d{44}$'),
    CONSTRAINT ck_fiscal_inbound_manifest_events_justification CHECK (
        event_type NOT IN ('DESCONHECIMENTO', 'NAO_REALIZADA')
        OR length(btrim(COALESCE(justification, ''))) >= 15
    )
);

CREATE INDEX IF NOT EXISTS idx_fiscal_inbound_manifest_events_company_environment_status
    ON public.fiscal_inbound_manifest_events (company_id, environment, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_fiscal_dfe_sync_state_updated_at ON public.fiscal_dfe_sync_state;
CREATE TRIGGER trg_fiscal_dfe_sync_state_updated_at
BEFORE UPDATE ON public.fiscal_dfe_sync_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_fiscal_inbound_dfe_updated_at ON public.fiscal_inbound_dfe;
CREATE TRIGGER trg_fiscal_inbound_dfe_updated_at
BEFORE UPDATE ON public.fiscal_inbound_dfe
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_fiscal_inbound_manifest_events_updated_at ON public.fiscal_inbound_manifest_events;
CREATE TRIGGER trg_fiscal_inbound_manifest_events_updated_at
BEFORE UPDATE ON public.fiscal_inbound_manifest_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.fiscal_dfe_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_inbound_dfe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_inbound_manifest_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_dfe_sync_state_select ON public.fiscal_dfe_sync_state;
DROP POLICY IF EXISTS fiscal_dfe_sync_state_insert ON public.fiscal_dfe_sync_state;
DROP POLICY IF EXISTS fiscal_dfe_sync_state_update ON public.fiscal_dfe_sync_state;
DROP POLICY IF EXISTS fiscal_dfe_sync_state_delete ON public.fiscal_dfe_sync_state;

CREATE POLICY fiscal_dfe_sync_state_select ON public.fiscal_dfe_sync_state
    FOR SELECT TO authenticated
    USING (public.is_member_of(company_id));

CREATE POLICY fiscal_dfe_sync_state_insert ON public.fiscal_dfe_sync_state
    FOR INSERT TO authenticated
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY fiscal_dfe_sync_state_update ON public.fiscal_dfe_sync_state
    FOR UPDATE TO authenticated
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY fiscal_dfe_sync_state_delete ON public.fiscal_dfe_sync_state
    FOR DELETE TO authenticated
    USING (public.is_member_of(company_id));

DROP POLICY IF EXISTS fiscal_inbound_dfe_select ON public.fiscal_inbound_dfe;
DROP POLICY IF EXISTS fiscal_inbound_dfe_insert ON public.fiscal_inbound_dfe;
DROP POLICY IF EXISTS fiscal_inbound_dfe_update ON public.fiscal_inbound_dfe;
DROP POLICY IF EXISTS fiscal_inbound_dfe_delete ON public.fiscal_inbound_dfe;

CREATE POLICY fiscal_inbound_dfe_select ON public.fiscal_inbound_dfe
    FOR SELECT TO authenticated
    USING (public.is_member_of(company_id));

CREATE POLICY fiscal_inbound_dfe_insert ON public.fiscal_inbound_dfe
    FOR INSERT TO authenticated
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY fiscal_inbound_dfe_update ON public.fiscal_inbound_dfe
    FOR UPDATE TO authenticated
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY fiscal_inbound_dfe_delete ON public.fiscal_inbound_dfe
    FOR DELETE TO authenticated
    USING (public.is_member_of(company_id));

DROP POLICY IF EXISTS fiscal_inbound_manifest_events_select ON public.fiscal_inbound_manifest_events;
DROP POLICY IF EXISTS fiscal_inbound_manifest_events_insert ON public.fiscal_inbound_manifest_events;
DROP POLICY IF EXISTS fiscal_inbound_manifest_events_update ON public.fiscal_inbound_manifest_events;
DROP POLICY IF EXISTS fiscal_inbound_manifest_events_delete ON public.fiscal_inbound_manifest_events;

CREATE POLICY fiscal_inbound_manifest_events_select ON public.fiscal_inbound_manifest_events
    FOR SELECT TO authenticated
    USING (public.is_member_of(company_id));

CREATE POLICY fiscal_inbound_manifest_events_insert ON public.fiscal_inbound_manifest_events
    FOR INSERT TO authenticated
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY fiscal_inbound_manifest_events_update ON public.fiscal_inbound_manifest_events
    FOR UPDATE TO authenticated
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY fiscal_inbound_manifest_events_delete ON public.fiscal_inbound_manifest_events
    FOR DELETE TO authenticated
    USING (public.is_member_of(company_id));

CREATE OR REPLACE FUNCTION public.set_dfe_sync_running(
    p_company_id UUID,
    p_environment TEXT
)
RETURNS public.fiscal_dfe_sync_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lock_key BIGINT;
    v_state public.fiscal_dfe_sync_state;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'company_id é obrigatório';
    END IF;

    IF p_environment NOT IN ('production', 'homologation') THEN
        RAISE EXCEPTION 'environment inválido: %', p_environment;
    END IF;

    IF auth.role() <> 'service_role' AND NOT public.is_member_of(p_company_id) THEN
        RAISE EXCEPTION 'acesso negado para company_id informado';
    END IF;

    v_lock_key := hashtextextended(p_company_id::text || ':' || p_environment, 0);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    INSERT INTO public.fiscal_dfe_sync_state (
        company_id,
        environment,
        status,
        last_sync_at,
        last_error
    ) VALUES (
        p_company_id,
        p_environment,
        'RUNNING',
        NOW(),
        NULL
    )
    ON CONFLICT (company_id, environment)
    DO UPDATE SET
        status = 'RUNNING',
        last_sync_at = NOW(),
        last_error = NULL,
        updated_at = NOW()
    RETURNING * INTO v_state;

    RETURN v_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_dfe_sync_result(
    p_company_id UUID,
    p_environment TEXT,
    p_last_nsu TEXT,
    p_status TEXT,
    p_last_error TEXT DEFAULT NULL
)
RETURNS public.fiscal_dfe_sync_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lock_key BIGINT;
    v_state public.fiscal_dfe_sync_state;
    v_status TEXT;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'company_id é obrigatório';
    END IF;

    IF p_environment NOT IN ('production', 'homologation') THEN
        RAISE EXCEPTION 'environment inválido: %', p_environment;
    END IF;

    v_status := UPPER(COALESCE(p_status, 'IDLE'));
    IF v_status NOT IN ('IDLE', 'ERROR') THEN
        RAISE EXCEPTION 'status inválido: %', p_status;
    END IF;

    IF auth.role() <> 'service_role' AND NOT public.is_member_of(p_company_id) THEN
        RAISE EXCEPTION 'acesso negado para company_id informado';
    END IF;

    v_lock_key := hashtextextended(p_company_id::text || ':' || p_environment, 0);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    INSERT INTO public.fiscal_dfe_sync_state (
        company_id,
        environment,
        last_nsu,
        status,
        last_error,
        last_sync_at
    ) VALUES (
        p_company_id,
        p_environment,
        COALESCE(NULLIF(p_last_nsu, ''), '0'),
        v_status,
        CASE WHEN v_status = 'ERROR' THEN p_last_error ELSE NULL END,
        NOW()
    )
    ON CONFLICT (company_id, environment)
    DO UPDATE SET
        last_nsu = COALESCE(NULLIF(p_last_nsu, ''), public.fiscal_dfe_sync_state.last_nsu),
        status = v_status,
        last_error = CASE WHEN v_status = 'ERROR' THEN p_last_error ELSE NULL END,
        last_sync_at = NOW(),
        updated_at = NOW()
    RETURNING * INTO v_state;

    RETURN v_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_inbound_dfe_batch(
    p_company_id UUID,
    p_environment TEXT,
    p_rows JSONB
)
RETURNS TABLE (
    inserted_count INTEGER,
    updated_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'company_id é obrigatório';
    END IF;

    IF p_environment NOT IN ('production', 'homologation') THEN
        RAISE EXCEPTION 'environment inválido: %', p_environment;
    END IF;

    IF jsonb_typeof(COALESCE(p_rows, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'p_rows deve ser um array JSON';
    END IF;

    IF auth.role() <> 'service_role' AND NOT public.is_member_of(p_company_id) THEN
        RAISE EXCEPTION 'acesso negado para company_id informado';
    END IF;

    WITH raw_rows AS (
        SELECT value AS row_data
        FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
    ),
    normalized AS (
        SELECT
            p_company_id AS company_id,
            p_environment AS environment,
            NULLIF(btrim(row_data->>'nsu'), '') AS nsu,
            COALESCE(NULLIF(btrim(row_data->>'schema'), ''), 'unknown') AS schema,
            NULLIF(regexp_replace(COALESCE(row_data->>'chnfe', ''), '\\D', '', 'g'), '') AS chnfe,
            NULLIF(regexp_replace(COALESCE(row_data->>'emit_cnpj', ''), '\\D', '', 'g'), '') AS emit_cnpj,
            NULLIF(btrim(row_data->>'emit_nome'), '') AS emit_nome,
            NULLIF(regexp_replace(COALESCE(row_data->>'dest_cnpj', ''), '\\D', '', 'g'), '') AS dest_cnpj,
            NULLIF(row_data->>'dh_emi', '')::timestamptz AS dh_emi,
            CASE
                WHEN NULLIF(row_data->>'total', '') IS NULL THEN NULL
                ELSE (row_data->>'total')::numeric(15,2)
            END AS total,
            CASE
                WHEN jsonb_typeof(row_data->'summary_json') = 'object' THEN row_data->'summary_json'
                ELSE '{}'::jsonb
            END AS summary_json,
            NULLIF(row_data->>'xml_base64', '') AS xml_base64,
            COALESCE((row_data->>'xml_is_gz')::boolean, false) AS xml_is_gz,
            COALESCE((row_data->>'has_full_xml')::boolean, false) AS has_full_xml,
            COALESCE(NULLIF(btrim(row_data->>'manifest_status'), ''), 'SEM_MANIFESTACAO') AS manifest_status,
            NULLIF(row_data->>'manifest_updated_at', '')::timestamptz AS manifest_updated_at
        FROM raw_rows
    ),
    valid_rows AS (
        SELECT *
        FROM normalized
        WHERE nsu IS NOT NULL
    ),
    upserted AS (
        INSERT INTO public.fiscal_inbound_dfe (
            company_id,
            environment,
            nsu,
            schema,
            chnfe,
            emit_cnpj,
            emit_nome,
            dest_cnpj,
            dh_emi,
            total,
            summary_json,
            xml_base64,
            xml_is_gz,
            has_full_xml,
            manifest_status,
            manifest_updated_at
        )
        SELECT
            company_id,
            environment,
            nsu,
            schema,
            chnfe,
            emit_cnpj,
            emit_nome,
            dest_cnpj,
            dh_emi,
            total,
            summary_json,
            xml_base64,
            xml_is_gz,
            has_full_xml,
            manifest_status,
            manifest_updated_at
        FROM valid_rows
        ON CONFLICT (company_id, environment, nsu)
        DO UPDATE SET
            schema = EXCLUDED.schema,
            chnfe = COALESCE(EXCLUDED.chnfe, public.fiscal_inbound_dfe.chnfe),
            emit_cnpj = COALESCE(EXCLUDED.emit_cnpj, public.fiscal_inbound_dfe.emit_cnpj),
            emit_nome = COALESCE(EXCLUDED.emit_nome, public.fiscal_inbound_dfe.emit_nome),
            dest_cnpj = COALESCE(EXCLUDED.dest_cnpj, public.fiscal_inbound_dfe.dest_cnpj),
            dh_emi = COALESCE(EXCLUDED.dh_emi, public.fiscal_inbound_dfe.dh_emi),
            total = COALESCE(EXCLUDED.total, public.fiscal_inbound_dfe.total),
            summary_json = CASE
                WHEN EXCLUDED.summary_json = '{}'::jsonb THEN public.fiscal_inbound_dfe.summary_json
                ELSE EXCLUDED.summary_json
            END,
            xml_base64 = COALESCE(EXCLUDED.xml_base64, public.fiscal_inbound_dfe.xml_base64),
            xml_is_gz = CASE
                WHEN EXCLUDED.xml_base64 IS NULL THEN public.fiscal_inbound_dfe.xml_is_gz
                ELSE EXCLUDED.xml_is_gz
            END,
            has_full_xml = public.fiscal_inbound_dfe.has_full_xml OR EXCLUDED.has_full_xml,
            manifest_status = COALESCE(EXCLUDED.manifest_status, public.fiscal_inbound_dfe.manifest_status),
            manifest_updated_at = COALESCE(EXCLUDED.manifest_updated_at, public.fiscal_inbound_dfe.manifest_updated_at),
            updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
    )
    SELECT
        COALESCE(COUNT(*) FILTER (WHERE inserted), 0)::integer,
        COALESCE(COUNT(*) FILTER (WHERE NOT inserted), 0)::integer
    INTO inserted_count, updated_count
    FROM upserted;

    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_manifest_event(
    p_company_id UUID,
    p_environment TEXT,
    p_chnfe TEXT,
    p_event_type TEXT,
    p_justification TEXT DEFAULT NULL
)
RETURNS public.fiscal_inbound_manifest_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_type TEXT;
    v_chnfe TEXT;
    v_row public.fiscal_inbound_manifest_events;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'company_id é obrigatório';
    END IF;

    IF p_environment NOT IN ('production', 'homologation') THEN
        RAISE EXCEPTION 'environment inválido: %', p_environment;
    END IF;

    v_event_type := UPPER(COALESCE(NULLIF(btrim(p_event_type), ''), ''));
    IF v_event_type NOT IN ('CIENCIA', 'CONFIRMACAO', 'DESCONHECIMENTO', 'NAO_REALIZADA') THEN
        RAISE EXCEPTION 'event_type inválido: %', p_event_type;
    END IF;

    v_chnfe := regexp_replace(COALESCE(p_chnfe, ''), '\\D', '', 'g');
    IF v_chnfe !~ '^\\d{44}$' THEN
        RAISE EXCEPTION 'chNFe inválida';
    END IF;

    IF v_event_type IN ('DESCONHECIMENTO', 'NAO_REALIZADA') AND length(btrim(COALESCE(p_justification, ''))) < 15 THEN
        RAISE EXCEPTION 'justificativa mínima de 15 caracteres para %', v_event_type;
    END IF;

    IF auth.role() <> 'service_role' AND NOT public.is_member_of(p_company_id) THEN
        RAISE EXCEPTION 'acesso negado para company_id informado';
    END IF;

    INSERT INTO public.fiscal_inbound_manifest_events (
        company_id,
        environment,
        chnfe,
        event_type,
        justification,
        status,
        last_error
    ) VALUES (
        p_company_id,
        p_environment,
        v_chnfe,
        v_event_type,
        NULLIF(btrim(p_justification), ''),
        'PENDING',
        NULL
    )
    ON CONFLICT (company_id, environment, chnfe, event_type)
    DO UPDATE SET
        justification = COALESCE(EXCLUDED.justification, public.fiscal_inbound_manifest_events.justification),
        status = CASE
            WHEN public.fiscal_inbound_manifest_events.status = 'ERROR' THEN 'PENDING'
            ELSE public.fiscal_inbound_manifest_events.status
        END,
        last_error = NULL,
        updated_at = NOW()
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_dfe_sync_running(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_dfe_sync_result(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_inbound_dfe_batch(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_manifest_event(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_dfe_sync_running(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_dfe_sync_result(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_inbound_dfe_batch(UUID, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_manifest_event(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
