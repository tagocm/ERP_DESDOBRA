-- Atomic creation of Revenue Category + child account 1.1.xx

CREATE OR REPLACE FUNCTION public.create_revenue_category_for_finished_product(
  p_company_id uuid,
  p_name text
)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  account_id uuid,
  account_code text,
  is_active boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_normalized_name text;
  v_parent_id uuid;
  v_parent_type text;
  v_parent_nature text;
  v_last_suffix integer;
  v_max_existing_suffix integer;
  v_next_suffix integer;
  v_account_id uuid;
  v_category_id uuid;
  v_category_name text;
  v_category_is_active boolean;
  v_account_code text;
BEGIN
  v_name := btrim(p_name);
  IF v_name IS NULL OR char_length(v_name) < 3 THEN
    RAISE EXCEPTION 'Nome da categoria deve ter ao menos 3 caracteres.' USING ERRCODE = '22023';
  END IF;

  IF auth.role() <> 'service_role' AND NOT public.is_member_of(p_company_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para criar categoria nesta empresa.' USING ERRCODE = '42501';
  END IF;

  -- Ensure base spine exists
  SELECT id, type, nature
    INTO v_parent_id, v_parent_type, v_parent_nature
  FROM public.gl_accounts
  WHERE company_id = p_company_id
    AND code = '1.1'
  LIMIT 1;

  IF v_parent_id IS NULL THEN
    PERFORM public.seed_chart_spine(p_company_id);

    SELECT id, type, nature
      INTO v_parent_id, v_parent_type, v_parent_nature
    FROM public.gl_accounts
    WHERE company_id = p_company_id
      AND code = '1.1'
    LIMIT 1;
  END IF;

  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'Conta pai 1.1 (Receita Bruta de Vendas) não encontrada.' USING ERRCODE = 'P0001';
  END IF;

  IF v_parent_type <> 'SINTETICA' OR v_parent_nature <> 'RECEITA' THEN
    RAISE EXCEPTION 'A conta 1.1 está inválida para receber categorias (esperado: SINTETICA/RECEITA).' USING ERRCODE = 'P0001';
  END IF;

  -- Per-company transactional lock for monotonic sequence generation
  PERFORM pg_advisory_xact_lock(hashtext('revenue_category_seq:' || p_company_id::text));

  INSERT INTO public.revenue_category_sequences (company_id, last_suffix)
  VALUES (p_company_id, 0)
  ON CONFLICT (company_id) DO NOTHING;

  SELECT last_suffix
    INTO v_last_suffix
  FROM public.revenue_category_sequences
  WHERE company_id = p_company_id
  FOR UPDATE;

  SELECT COALESCE(MAX((regexp_match(code, '^1\.1\.(\d+)$'))[1]::integer), 0)
    INTO v_max_existing_suffix
  FROM public.gl_accounts
  WHERE company_id = p_company_id
    AND parent_id = v_parent_id
    AND code ~ '^1\.1\.\d+$';

  v_next_suffix := GREATEST(COALESCE(v_last_suffix, 0), COALESCE(v_max_existing_suffix, 0)) + 1;

  UPDATE public.revenue_category_sequences
    SET last_suffix = v_next_suffix
  WHERE company_id = p_company_id;

  v_account_code := '1.1.' || LPAD(v_next_suffix::text, 2, '0');
  v_normalized_name := lower(v_name);

  INSERT INTO public.gl_accounts (
    company_id,
    code,
    name,
    type,
    nature,
    parent_id,
    is_active,
    is_system_locked,
    origin,
    origin_id
  ) VALUES (
    p_company_id,
    v_account_code,
    v_name,
    'ANALITICA',
    'RECEITA',
    v_parent_id,
    true,
    false,
    'PRODUCT_CATEGORY',
    NULL
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.product_categories (
    company_id,
    name,
    normalized_name,
    is_active,
    revenue_account_id
  ) VALUES (
    p_company_id,
    v_name,
    v_normalized_name,
    true,
    v_account_id
  )
  RETURNING id, name, public.product_categories.is_active
    INTO v_category_id, v_category_name, v_category_is_active;

  UPDATE public.gl_accounts
    SET origin_id = v_category_id
  WHERE id = v_account_id;

  RETURN QUERY
  SELECT
    v_category_id,
    v_category_name,
    v_account_id,
    v_account_code,
    v_category_is_active;

EXCEPTION
  WHEN unique_violation THEN
    IF position('product_categories' IN SQLERRM) > 0 THEN
      RAISE EXCEPTION 'Já existe uma categoria com este nome nesta empresa.' USING ERRCODE = '23505';
    ELSIF position('gl_accounts' IN SQLERRM) > 0 THEN
      RAISE EXCEPTION 'Falha ao gerar código contábil único para a categoria. Tente novamente.' USING ERRCODE = '23505';
    ELSE
      RAISE;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_revenue_category_for_finished_product(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_revenue_category_for_finished_product(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_revenue_category_for_finished_product(uuid, text) TO service_role;
