-- Purpose: remove need for service-role in public mobile ingestion endpoints.
--
-- Security model:
-- - Mobile devices authenticate with a per-device bearer token (mb_*), stored hashed in mobile_api_tokens.token_hash
-- - Public API routes call these RPCs using the ANON key (no service role)
-- - SECURITY DEFINER functions validate token + insert events; callers have no table access
--
-- NOTE: Granting EXECUTE to anon is safe here because the token hash is unguessable and the function performs strict validation.

BEGIN;

CREATE OR REPLACE FUNCTION public.mobile_validate_token(_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_id uuid;
    v_company_id uuid;
BEGIN
    IF _token_hash IS NULL OR length(_token_hash) < 16 THEN
        RETURN NULL;
    END IF;

    SELECT id, company_id
      INTO v_token_id, v_company_id
      FROM public.mobile_api_tokens
     WHERE token_hash = _token_hash
       AND is_active = true
       AND (expires_at IS NULL OR expires_at > now())
     LIMIT 1;

    IF v_token_id IS NULL THEN
        RETURN NULL;
    END IF;

    UPDATE public.mobile_api_tokens
       SET last_used_at = now()
     WHERE id = v_token_id;

    RETURN v_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mobile_ingest_events(_token_hash text, _events jsonb)
RETURNS TABLE(event_id text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id uuid;
    v_event jsonb;
    v_event_id_text text;
    v_event_id uuid;
    v_event_type text;
    v_payload jsonb;
BEGIN
    v_company_id := public.mobile_validate_token(_token_hash);
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING errcode = '28000';
    END IF;

    IF jsonb_typeof(_events) <> 'array' THEN
        RAISE EXCEPTION 'Invalid payload' USING errcode = '22023';
    END IF;

    IF jsonb_array_length(_events) > 50 THEN
        RAISE EXCEPTION 'Too many events' USING errcode = '22023';
    END IF;

    FOR v_event IN SELECT * FROM jsonb_array_elements(_events)
    LOOP
        v_event_id_text := v_event ->> 'event_id';
        v_event_type := v_event ->> 'type';
        v_payload := v_event -> 'payload';

        BEGIN
            v_event_id := v_event_id_text::uuid;

            IF v_event_type IS NULL OR length(trim(v_event_type)) = 0 OR v_payload IS NULL THEN
                RETURN QUERY SELECT v_event_id_text, 'error';
                CONTINUE;
            END IF;

            INSERT INTO public.mobile_expense_events (company_id, event_id, event_type, payload, status)
            VALUES (v_company_id, v_event_id, v_event_type, v_payload, 'received')
            ON CONFLICT (event_id) DO NOTHING;

            IF FOUND THEN
                RETURN QUERY SELECT v_event_id_text, 'accepted';
            ELSE
                RETURN QUERY SELECT v_event_id_text, 'duplicate';
            END IF;
        EXCEPTION WHEN others THEN
            RETURN QUERY SELECT COALESCE(v_event_id_text, ''), 'error';
        END;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.mobile_validate_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mobile_ingest_events(text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mobile_validate_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.mobile_ingest_events(text, jsonb) TO anon;

GRANT EXECUTE ON FUNCTION public.mobile_validate_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_ingest_events(text, jsonb) TO authenticated;

COMMIT;

