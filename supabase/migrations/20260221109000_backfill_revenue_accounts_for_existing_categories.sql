-- Backfill legado: vincula categorias existentes a contas filhas de 1.1
-- Deve rodar ANTES das constraints de integridade (20260221110000_*).

DO $$
DECLARE
  v_company_id uuid;
  v_parent_id uuid;
  v_next_suffix integer;
  v_account_id uuid;
  v_code text;
  v_category record;
BEGIN
  FOR v_company_id IN
    SELECT DISTINCT pc.company_id
    FROM public.product_categories pc
    WHERE pc.company_id IS NOT NULL
      AND pc.revenue_account_id IS NULL
  LOOP
    -- Garante espinha contábil base para a empresa.
    PERFORM public.seed_chart_spine(v_company_id);

    SELECT ga.id
      INTO v_parent_id
    FROM public.gl_accounts ga
    WHERE ga.company_id = v_company_id
      AND ga.code = '1.1'
    LIMIT 1;

    IF v_parent_id IS NULL THEN
      RAISE EXCEPTION 'Conta pai 1.1 não encontrada para empresa %', v_company_id;
    END IF;

    SELECT COALESCE(MAX((regexp_match(ga.code, '^1\.1\.(\d+)$'))[1]::integer), 0) + 1
      INTO v_next_suffix
    FROM public.gl_accounts ga
    WHERE ga.company_id = v_company_id
      AND ga.parent_id = v_parent_id
      AND ga.code ~ '^1\.1\.\d+$';

    FOR v_category IN
      SELECT
        pc.id,
        pc.name,
        pc.is_active
      FROM public.product_categories pc
      WHERE pc.company_id = v_company_id
        AND pc.revenue_account_id IS NULL
      ORDER BY pc.created_at, pc.id
    LOOP
      -- 1) Tenta reaproveitar conta já ligada por origin_id.
      SELECT ga.id
        INTO v_account_id
      FROM public.gl_accounts ga
      WHERE ga.company_id = v_company_id
        AND ga.origin = 'PRODUCT_CATEGORY'
        AND ga.origin_id = v_category.id
      LIMIT 1;

      -- 2) Tenta reaproveitar conta por nome/origem sem origin_id.
      IF v_account_id IS NULL THEN
        SELECT ga.id
          INTO v_account_id
        FROM public.gl_accounts ga
        WHERE ga.company_id = v_company_id
          AND ga.origin = 'PRODUCT_CATEGORY'
          AND ga.parent_id = v_parent_id
          AND lower(ga.name) = lower(v_category.name)
          AND (ga.origin_id IS NULL OR ga.origin_id = v_category.id)
        ORDER BY ga.created_at, ga.id
        LIMIT 1;
      END IF;

      -- 3) Se não existir, cria conta nova com código incremental 1.1.xx
      IF v_account_id IS NULL THEN
        v_code := '1.1.' || LPAD(v_next_suffix::text, 2, '0');

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
          'RECEITA',
          v_parent_id,
          COALESCE(v_category.is_active, true),
          false,
          'PRODUCT_CATEGORY',
          v_category.id
        )
        RETURNING id INTO v_account_id;

        v_next_suffix := v_next_suffix + 1;
      ELSE
        -- Higieniza metadados da conta reaproveitada.
        UPDATE public.gl_accounts ga
          SET parent_id = COALESCE(ga.parent_id, v_parent_id),
              type = COALESCE(ga.type, 'ANALITICA'),
              nature = COALESCE(ga.nature, 'RECEITA'),
              origin = 'PRODUCT_CATEGORY',
              origin_id = COALESCE(ga.origin_id, v_category.id),
              is_system_locked = COALESCE(ga.is_system_locked, false),
              is_active = COALESCE(ga.is_active, COALESCE(v_category.is_active, true))
        WHERE ga.id = v_account_id;
      END IF;

      -- 4) Fecha vínculo categoria -> conta.
      UPDATE public.product_categories pc
        SET revenue_account_id = v_account_id,
            is_active = COALESCE(pc.is_active, true),
            normalized_name = COALESCE(pc.normalized_name, lower(btrim(pc.name)))
      WHERE pc.id = v_category.id;
    END LOOP;
  END LOOP;
END $$;

