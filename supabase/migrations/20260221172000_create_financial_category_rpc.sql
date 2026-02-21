-- Atomic creation of Financial Category + child account under 4.* (Despesas Operacionais)

-- Validate integrity constraint after backfill
ALTER TABLE public.financial_categories
  VALIDATE CONSTRAINT financial_categories_active_requires_expense_account;

CREATE OR REPLACE FUNCTION public.create_financial_category_for_operational_expense(
  p_company_id uuid,
  p_parent_account_id uuid,
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
  v_parent_code text;
  v_parent_type text;
  v_parent_nature text;
  v_parent_code_re text;
  v_child_code_regex text;
  v_child_where_regex text;
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

  -- Parent folder must exist, be synthetic, be an expense, and live inside code 4.*
  SELECT code, type, nature
    INTO v_parent_code, v_parent_type, v_parent_nature
  FROM public.gl_accounts
  WHERE id = p_parent_account_id
    AND company_id = p_company_id
  LIMIT 1;

  IF v_parent_code IS NULL THEN
    RAISE EXCEPTION 'Subcategoria (Plano de Contas) não encontrada.' USING ERRCODE = 'P0001';
  END IF;

  IF v_parent_type <> 'SINTETICA' THEN
    RAISE EXCEPTION 'Selecione uma subcategoria (conta sintética) para vincular a categoria.' USING ERRCODE = 'P0001';
  END IF;

  IF v_parent_nature <> 'DESPESA' THEN
    RAISE EXCEPTION 'A subcategoria selecionada não é uma conta de DESPESA.' USING ERRCODE = 'P0001';
  END IF;

  IF v_parent_code !~ '^4(\\.|$)' THEN
    RAISE EXCEPTION 'A subcategoria deve estar dentro do item 4 (Despesas Operacionais).' USING ERRCODE = 'P0001';
  END IF;

  -- Ensure fixed chart spine exists (idempotent)
  PERFORM public.seed_chart_spine(p_company_id);

  -- Per-company + per-parent transactional lock for monotonic sequence generation
  PERFORM pg_advisory_xact_lock(hashtext('financial_category_seq:' || p_company_id::text || ':' || p_parent_account_id::text));

  INSERT INTO public.financial_category_sequences (company_id, parent_account_id, last_suffix)
  VALUES (p_company_id, p_parent_account_id, 0)
  ON CONFLICT (company_id, parent_account_id) DO NOTHING;

  SELECT last_suffix
    INTO v_last_suffix
  FROM public.financial_category_sequences
  WHERE company_id = p_company_id
    AND parent_account_id = p_parent_account_id
  FOR UPDATE;

  v_parent_code_re := replace(v_parent_code, '.', '\\.');
  v_child_code_regex := '^' || v_parent_code_re || '\\.(\\d+)$';
  v_child_where_regex := '^' || v_parent_code_re || '\\.\\d+$';

  SELECT COALESCE(MAX((regexp_match(code, v_child_code_regex))[1]::integer), 0)
    INTO v_max_existing_suffix
  FROM public.gl_accounts
  WHERE company_id = p_company_id
    AND parent_id = p_parent_account_id
    AND code ~ v_child_where_regex;

  v_next_suffix := GREATEST(COALESCE(v_last_suffix, 0), COALESCE(v_max_existing_suffix, 0)) + 1;

  UPDATE public.financial_category_sequences
    SET last_suffix = v_next_suffix
  WHERE company_id = p_company_id
    AND parent_account_id = p_parent_account_id;

  v_account_code := v_parent_code || '.' || LPAD(v_next_suffix::text, 2, '0');

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
    'DESPESA',
    p_parent_account_id,
    true,
    false,
    'FINANCIAL_CATEGORY',
    NULL
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.financial_categories (
    company_id,
    name,
    is_active,
    expense_account_id
  ) VALUES (
    p_company_id,
    v_name,
    true,
    v_account_id
  )
  RETURNING id, name, public.financial_categories.is_active
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
    IF position('financial_categories' IN SQLERRM) > 0 THEN
      RAISE EXCEPTION 'Já existe uma categoria com este nome nesta empresa.' USING ERRCODE = '23505';
    ELSIF position('gl_accounts' IN SQLERRM) > 0 THEN
      RAISE EXCEPTION 'Falha ao gerar código contábil único para a categoria. Tente novamente.' USING ERRCODE = '23505';
    ELSE
      RAISE;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_financial_category_for_operational_expense(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_financial_category_for_operational_expense(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_financial_category_for_operational_expense(uuid, uuid, text) TO service_role;

