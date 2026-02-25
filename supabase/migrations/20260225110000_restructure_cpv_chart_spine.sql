BEGIN;

-- Reorganiza o grupo 3 (CPV) para o modelo industrial sem recriar árvore inteira.
-- Regras:
-- - idempotente (ON CONFLICT por company_id+code)
-- - não remove contas existentes
-- - não altera IDs
-- - só renomeia/reparenta quando não há uso

CREATE OR REPLACE FUNCTION public.seed_chart_spine(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root_receitas uuid;
  v_receita_bruta uuid;
  v_root_deducoes uuid;
  v_root_custo uuid;
  v_cpv_materiais uuid;
  v_cpv_mod uuid;
  v_cpv_cif uuid;
  v_root_despesas uuid;
  v_desp_comerciais uuid;
  v_desp_adm uuid;
  v_desp_log uuid;
  v_root_resultado_fin uuid;
BEGIN
  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin)
  VALUES (p_company_id, '1', 'RECEITAS', 'SINTETICA', 'RECEITA', true, 'SYSTEM')
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM'
  RETURNING id INTO v_root_receitas;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  VALUES (p_company_id, '1.1', 'Receita Bruta de Vendas', 'SINTETICA', 'RECEITA', true, 'SYSTEM', v_root_receitas)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_receitas
  RETURNING id INTO v_receita_bruta;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin)
  VALUES (p_company_id, '2', 'DEDUÇÕES DA RECEITA', 'SINTETICA', 'DEDUCAO', true, 'SYSTEM')
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM'
  RETURNING id INTO v_root_deducoes;

  WITH p AS (
    INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '2.1', 'Impostos sobre Vendas', 'SINTETICA', 'DEDUCAO', true, 'SYSTEM', v_root_deducoes)
    ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
    DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_deducoes
    RETURNING id
  )
  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  SELECT p_company_id, c, n, 'ANALITICA', 'DEDUCAO', true, 'SYSTEM', (SELECT id FROM p)
  FROM (VALUES ('2.1.01', 'ICMS'), ('2.1.02', 'PIS'), ('2.1.03', 'COFINS')) AS t(c, n)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique DO NOTHING;

  WITH p AS (
    INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '2.2', 'Devoluções', 'SINTETICA', 'DEDUCAO', true, 'SYSTEM', v_root_deducoes)
    ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
    DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_deducoes
    RETURNING id
  )
  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  VALUES (p_company_id, '2.2.01', 'Devoluções de Vendas', 'ANALITICA', 'DEDUCAO', true, 'SYSTEM', (SELECT id FROM p))
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique DO NOTHING;

  WITH p AS (
    INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '2.3', 'Descontos Concedidos', 'SINTETICA', 'DEDUCAO', true, 'SYSTEM', v_root_deducoes)
    ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
    DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_deducoes
    RETURNING id
  )
  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  VALUES (p_company_id, '2.3.01', 'Descontos Incondicionais', 'ANALITICA', 'DEDUCAO', true, 'SYSTEM', (SELECT id FROM p))
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique DO NOTHING;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin)
  VALUES (p_company_id, '3', 'CUSTO DOS PRODUTOS VENDIDOS', 'SINTETICA', 'CUSTO', true, 'SYSTEM')
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM'
  RETURNING id INTO v_root_custo;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  VALUES (p_company_id, '3.1', 'Materiais Diretos', 'SINTETICA', 'CUSTO', true, 'SYSTEM', v_root_custo)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_custo
  RETURNING id INTO v_cpv_materiais;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  SELECT p_company_id, c, n, 'ANALITICA', 'CUSTO', true, 'SYSTEM', v_cpv_materiais
  FROM (VALUES
    ('3.1.01', 'Matéria-prima'),
    ('3.1.02', 'Embalagens'),
    ('3.1.03', 'Insumos auxiliares')
  ) AS t(c, n)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique DO NOTHING;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  VALUES (p_company_id, '3.2', 'Mão de Obra Direta (MOD)', 'SINTETICA', 'CUSTO', true, 'SYSTEM', v_root_custo)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_custo
  RETURNING id INTO v_cpv_mod;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  VALUES (p_company_id, '3.2.01', 'MOD Produção (Salários + Encargos)', 'ANALITICA', 'CUSTO', true, 'SYSTEM', v_cpv_mod)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique DO NOTHING;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  VALUES (p_company_id, '3.3', 'Custos Indiretos de Fabricação (CIF)', 'SINTETICA', 'CUSTO', true, 'SYSTEM', v_root_custo)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_custo
  RETURNING id INTO v_cpv_cif;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  SELECT p_company_id, c, n, 'ANALITICA', 'CUSTO', true, 'SYSTEM', v_cpv_cif
  FROM (VALUES
    ('3.3.01', 'Energia Produção'),
    ('3.3.02', 'Manutenção Produção')
  ) AS t(c, n)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique DO NOTHING;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin)
  VALUES (p_company_id, '4', 'DESPESAS OPERACIONAIS', 'SINTETICA', 'DESPESA', true, 'SYSTEM')
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM'
  RETURNING id INTO v_root_despesas;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  VALUES (p_company_id, '4.1', 'Despesas Comerciais', 'SINTETICA', 'DESPESA', true, 'SYSTEM', v_root_despesas)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_despesas
  RETURNING id INTO v_desp_comerciais;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  SELECT p_company_id, c, n, 'ANALITICA', 'DESPESA', true, 'SYSTEM', v_desp_comerciais
  FROM (VALUES ('4.1.01', 'Comissões'), ('4.1.02', 'Marketing'), ('4.1.03', 'Fretes sobre Vendas'), ('4.1.04', 'Representantes')) AS t(c, n)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique DO NOTHING;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  VALUES (p_company_id, '4.2', 'Despesas Administrativas', 'SINTETICA', 'DESPESA', true, 'SYSTEM', v_root_despesas)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_despesas
  RETURNING id INTO v_desp_adm;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  SELECT p_company_id, c, n, 'ANALITICA', 'DESPESA', true, 'SYSTEM', v_desp_adm
  FROM (VALUES
    ('4.2.01', 'Salários Administrativos'),
    ('4.2.02', 'Pró-Labore'),
    ('4.2.03', 'Contabilidade'),
    ('4.2.04', 'Sistemas / Softwares'),
    ('4.2.05', 'Serviços Terceiros'),
    ('4.2.06', 'Aluguel'),
    ('4.2.07', 'Energia Elétrica'),
    ('4.2.08', 'Telefonia'),
    ('4.2.09', 'Internet'),
    ('4.2.10', 'Manutenção Predial / Detetização'),
    ('4.2.11', 'Segurança do Trabalho'),
    ('4.2.12', 'Despesas Gerais Administrativas')
  ) AS t(c, n)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique DO NOTHING;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  VALUES (p_company_id, '4.3', 'Despesas Logísticas', 'SINTETICA', 'DESPESA', true, 'SYSTEM', v_root_despesas)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_despesas
  RETURNING id INTO v_desp_log;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  SELECT p_company_id, c, n, 'ANALITICA', 'DESPESA', true, 'SYSTEM', v_desp_log
  FROM (VALUES ('4.3.01', 'Combustível'), ('4.3.02', 'Manutenção Veículos'), ('4.3.03', 'Seguro / IPVA')) AS t(c, n)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique DO NOTHING;

  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin)
  VALUES (p_company_id, '5', 'RESULTADO FINANCEIRO', 'SINTETICA', 'FINANCEIRO', true, 'SYSTEM')
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
  DO UPDATE SET is_system_locked = true, origin = 'SYSTEM'
  RETURNING id INTO v_root_resultado_fin;

  WITH p AS (
    INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '5.1', 'Receitas Financeiras', 'SINTETICA', 'FINANCEIRO', true, 'SYSTEM', v_root_resultado_fin)
    ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
    DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_resultado_fin
    RETURNING id
  )
  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  SELECT p_company_id, c, n, 'ANALITICA', 'FINANCEIRO', true, 'SYSTEM', (SELECT id FROM p)
  FROM (VALUES ('5.1.01', 'Rendimentos'), ('5.1.02', 'Descontos Obtidos')) AS t(c, n)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique DO NOTHING;

  WITH p AS (
    INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '5.2', 'Despesas Financeiras', 'SINTETICA', 'FINANCEIRO', true, 'SYSTEM', v_root_resultado_fin)
    ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
    DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_resultado_fin
    RETURNING id
  )
  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  SELECT p_company_id, c, n, 'ANALITICA', 'FINANCEIRO', true, 'SYSTEM', (SELECT id FROM p)
  FROM (VALUES ('5.2.01', 'Juros Bancários'), ('5.2.02', 'Tarifas Bancárias'), ('5.2.03', 'Juros Empréstimos')) AS t(c, n)
  ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique DO NOTHING;
END;
$$;

-- Backfill seguro para empresas existentes:
-- 1) garante criação das novas contas do CPV
-- 2) aplica flags SYSTEM/LOCKED
-- 3) ajusta nome/parent_id somente para contas sem uso
DO $$
DECLARE
  v_company_id uuid;
BEGIN
  FOR v_company_id IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_chart_spine(v_company_id);

    UPDATE public.gl_accounts ga
       SET is_system_locked = true,
           origin = 'SYSTEM'
     WHERE ga.company_id = v_company_id
       AND ga.code IN ('3', '3.1', '3.1.01', '3.1.02', '3.1.03', '3.2', '3.2.01', '3.3', '3.3.01', '3.3.02');

    WITH roots AS (
      SELECT
        (SELECT id FROM public.gl_accounts WHERE company_id = v_company_id AND code = '3' LIMIT 1) AS root_3,
        (SELECT id FROM public.gl_accounts WHERE company_id = v_company_id AND code = '3.1' LIMIT 1) AS root_31,
        (SELECT id FROM public.gl_accounts WHERE company_id = v_company_id AND code = '3.2' LIMIT 1) AS root_32,
        (SELECT id FROM public.gl_accounts WHERE company_id = v_company_id AND code = '3.3' LIMIT 1) AS root_33
    ),
    expected AS (
      SELECT '3.1'::text AS code, root_3 AS expected_parent FROM roots
      UNION ALL SELECT '3.1.01', root_31 FROM roots
      UNION ALL SELECT '3.1.02', root_31 FROM roots
      UNION ALL SELECT '3.1.03', root_31 FROM roots
      UNION ALL SELECT '3.2', root_3 FROM roots
      UNION ALL SELECT '3.2.01', root_32 FROM roots
      UNION ALL SELECT '3.3', root_3 FROM roots
      UNION ALL SELECT '3.3.01', root_33 FROM roots
      UNION ALL SELECT '3.3.02', root_33 FROM roots
    )
    UPDATE public.gl_accounts ga
       SET parent_id = e.expected_parent
      FROM expected e
     WHERE ga.company_id = v_company_id
       AND ga.code = e.code
       AND e.expected_parent IS NOT NULL
       AND ga.parent_id IS DISTINCT FROM e.expected_parent
       AND NOT EXISTS (
         SELECT 1
         FROM (
           SELECT ai.account_id AS account_id FROM public.ar_installments ai
           UNION ALL SELECT ai.account_id FROM public.ap_installments ai
           UNION ALL SELECT fei.suggested_account_id FROM public.financial_event_installments fei
           UNION ALL SELECT aa.gl_account_id FROM public.ar_installment_allocations aa
           UNION ALL SELECT aa.gl_account_id FROM public.ap_installment_allocations aa
           UNION ALL SELECT pc.revenue_account_id FROM public.product_categories pc
           UNION ALL SELECT fc.expense_account_id FROM public.financial_categories fc
         ) used
         WHERE used.account_id = ga.id
       );

    UPDATE public.gl_accounts ga
       SET name = mapping.target_name
      FROM (
        VALUES
          ('3.1'::text, 'Materiais Diretos'::text),
          ('3.1.01'::text, 'Matéria-prima'::text),
          ('3.1.02'::text, 'Embalagens'::text),
          ('3.1.03'::text, 'Insumos auxiliares'::text),
          ('3.2'::text, 'Mão de Obra Direta (MOD)'::text),
          ('3.2.01'::text, 'MOD Produção (Salários + Encargos)'::text),
          ('3.3'::text, 'Custos Indiretos de Fabricação (CIF)'::text),
          ('3.3.01'::text, 'Energia Produção'::text),
          ('3.3.02'::text, 'Manutenção Produção'::text)
      ) AS mapping(code, target_name)
     WHERE ga.company_id = v_company_id
       AND ga.code = mapping.code
       AND ga.name IS DISTINCT FROM mapping.target_name
       AND NOT EXISTS (
         SELECT 1
         FROM (
           SELECT ai.account_id AS account_id FROM public.ar_installments ai
           UNION ALL SELECT ai.account_id FROM public.ap_installments ai
           UNION ALL SELECT fei.suggested_account_id FROM public.financial_event_installments fei
           UNION ALL SELECT aa.gl_account_id FROM public.ar_installment_allocations aa
           UNION ALL SELECT aa.gl_account_id FROM public.ap_installment_allocations aa
           UNION ALL SELECT pc.revenue_account_id FROM public.product_categories pc
           UNION ALL SELECT fc.expense_account_id FROM public.financial_categories fc
         ) used
         WHERE used.account_id = ga.id
       );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_chart_spine(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_chart_spine(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_chart_spine(uuid) TO service_role;

COMMIT;
