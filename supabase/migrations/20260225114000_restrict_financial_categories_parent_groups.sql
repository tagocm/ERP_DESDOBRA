BEGIN;

-- Restringe categorias financeiras (fatos geradores) aos grupos permitidos:
-- 3.3 (CIF), 4.1, 4.2 e 4.3.
-- Mantém retrocompatibilidade: não remove categorias/contas existentes.

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

  IF v_parent_code NOT IN ('3.3', '4.1', '4.2', '4.3') THEN
    RAISE EXCEPTION 'A subcategoria deve ser uma destas: 3.3, 4.1, 4.2 ou 4.3.' USING ERRCODE = 'P0001';
  END IF;

  IF v_parent_nature NOT IN ('CUSTO', 'DESPESA') THEN
    RAISE EXCEPTION 'A subcategoria selecionada não pertence a CUSTO ou DESPESA.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.seed_chart_spine(p_company_id);

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
    v_parent_nature,
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

CREATE OR REPLACE FUNCTION public.seed_financial_categories_for_operational_expenses(
  p_company_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_member_of(p_company_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para sincronizar categorias nesta empresa.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.seed_chart_spine(p_company_id);

  INSERT INTO public.financial_categories (
    company_id,
    name,
    is_active,
    expense_account_id
  )
  SELECT
    a.company_id,
    a.name,
    COALESCE(a.is_active, true),
    a.id
  FROM public.gl_accounts a
  JOIN public.gl_accounts p ON p.id = a.parent_id
  WHERE a.company_id = p_company_id
    AND a.type = 'ANALITICA'
    AND p.code IN ('3.3', '4.1', '4.2', '4.3')
    AND NOT EXISTS (
      SELECT 1
      FROM public.financial_categories c
      WHERE c.company_id = a.company_id
        AND c.deleted_at IS NULL
        AND c.expense_account_id = a.id
    )
  -- Idempotência defensiva:
  -- `ON CONFLICT (cols) WHERE ...` exige um unique index exatamente inferível, o que pode variar em
  -- bases locais já existentes (drift/restore). Como já filtramos via NOT EXISTS, aqui usamos um
  -- `ON CONFLICT DO NOTHING` genérico para evitar quebra por ausência do índice.
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.create_financial_category_for_operational_expense(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_financial_category_for_operational_expense(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_financial_category_for_operational_expense(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.seed_financial_categories_for_operational_expenses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_financial_categories_for_operational_expenses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_financial_categories_for_operational_expenses(uuid) TO service_role;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_chart_spine(r.id);
    PERFORM public.seed_financial_categories_for_operational_expenses(r.id);
  END LOOP;
END $$;

COMMIT;
