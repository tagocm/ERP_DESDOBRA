-- Backfill: vincula categorias financeiras existentes a contas finais sob 4.2 (Despesas Administrativas)
--
-- Notes:
-- - Only categories with deleted_at IS NULL are considered "active" and require linkage.
-- - Default parent chosen for legacy rows: 4.2 (Despesas Administrativas).
-- - Uses a per-company+parent advisory lock + financial_category_sequences to avoid code reuse.

DO $$
DECLARE
  v_company_id uuid;
  v_parent_id uuid;
  v_parent_code text;
  v_parent_code_re text;
  v_child_code_regex text;
  v_child_where_regex text;
  v_last_suffix integer;
  v_max_existing_suffix integer;
  v_next_suffix integer;
  v_account_id uuid;
  v_code text;
  v_category record;
BEGIN
  FOR v_company_id IN
    SELECT DISTINCT fc.company_id
    FROM public.financial_categories fc
    WHERE fc.deleted_at IS NULL
      AND fc.expense_account_id IS NULL
  LOOP
    -- Ensure fixed chart spine exists for this tenant.
    PERFORM public.seed_chart_spine(v_company_id);

    -- Default parent for legacy mapping
    SELECT ga.id, ga.code
      INTO v_parent_id, v_parent_code
    FROM public.gl_accounts ga
    WHERE ga.company_id = v_company_id
      AND ga.code = '4.2'
    LIMIT 1;

    IF v_parent_id IS NULL THEN
      RAISE EXCEPTION 'Conta pai 4.2 (Despesas Administrativas) não encontrada para empresa %', v_company_id;
    END IF;

    -- Lock per-company+parent for monotonic suffix generation
    PERFORM pg_advisory_xact_lock(hashtext('financial_category_seq:' || v_company_id::text || ':' || v_parent_id::text));

    INSERT INTO public.financial_category_sequences (company_id, parent_account_id, last_suffix)
    VALUES (v_company_id, v_parent_id, 0)
    ON CONFLICT (company_id, parent_account_id) DO NOTHING;

    SELECT last_suffix
      INTO v_last_suffix
    FROM public.financial_category_sequences
    WHERE company_id = v_company_id
      AND parent_account_id = v_parent_id
    FOR UPDATE;

    v_parent_code_re := replace(v_parent_code, '.', '\\.');
    v_child_code_regex := '^' || v_parent_code_re || '\\.(\\d+)$';
    v_child_where_regex := '^' || v_parent_code_re || '\\.\\d+$';

    -- Existing max suffix under the chosen parent
    SELECT COALESCE(MAX((regexp_match(code, v_child_code_regex))[1]::integer), 0)
      INTO v_max_existing_suffix
    FROM public.gl_accounts
    WHERE company_id = v_company_id
      AND parent_id = v_parent_id
      AND code ~ v_child_where_regex;

    v_next_suffix := GREATEST(COALESCE(v_last_suffix, 0), COALESCE(v_max_existing_suffix, 0)) + 1;

    FOR v_category IN
      SELECT id, name, is_active
      FROM public.financial_categories
      WHERE company_id = v_company_id
        AND deleted_at IS NULL
        AND expense_account_id IS NULL
      ORDER BY created_at, id
    LOOP
      v_code := v_parent_code || '.' || LPAD(v_next_suffix::text, 2, '0');

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
        v_company_id,
        v_code,
        v_category.name,
        'ANALITICA',
        'DESPESA',
        v_parent_id,
        COALESCE(v_category.is_active, true),
        false,
        'FINANCIAL_CATEGORY',
        v_category.id
      )
      RETURNING id INTO v_account_id;

      UPDATE public.financial_categories
        SET expense_account_id = v_account_id
      WHERE id = v_category.id;

      v_next_suffix := v_next_suffix + 1;
    END LOOP;

    -- Persist sequence to avoid reuse even if rows are later removed.
    UPDATE public.financial_category_sequences
      SET last_suffix = v_next_suffix - 1
    WHERE company_id = v_company_id
      AND parent_account_id = v_parent_id;
  END LOOP;
END $$;

