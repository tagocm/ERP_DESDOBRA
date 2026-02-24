-- Hardening do seed do Plano de Contas para eliminar falhas de ambientes com schema drift

-- 1) Garantir colunas necessárias do modelo atual
ALTER TABLE public.gl_accounts
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.gl_accounts(id),
  ADD COLUMN IF NOT EXISTS nature text,
  ADD COLUMN IF NOT EXISTS is_system_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origin text;

-- 2) Normalizar dados legados
UPDATE public.gl_accounts
SET type = 'ANALITICA'
WHERE type IS NULL OR type NOT IN ('SINTETICA', 'ANALITICA');

UPDATE public.gl_accounts
SET nature = CASE
  WHEN code LIKE '1%' THEN 'RECEITA'
  WHEN code LIKE '2%' THEN 'DEDUCAO'
  WHEN code LIKE '3%' THEN 'CUSTO'
  WHEN code LIKE '4%' THEN 'DESPESA'
  WHEN code LIKE '5%' THEN 'FINANCEIRO'
  ELSE 'DESPESA'
END
WHERE nature IS NULL OR nature NOT IN ('RECEITA', 'DEDUCAO', 'CUSTO', 'DESPESA', 'FINANCEIRO');

UPDATE public.gl_accounts
SET origin = 'MANUAL'
WHERE origin IS NULL OR origin NOT IN ('SYSTEM', 'PRODUCT_CATEGORY', 'FINANCIAL_CATEGORY', 'MANUAL');

-- 3) Recriar checks canônicos
ALTER TABLE public.gl_accounts
  DROP CONSTRAINT IF EXISTS gl_accounts_type_check,
  DROP CONSTRAINT IF EXISTS gl_accounts_nature_check,
  DROP CONSTRAINT IF EXISTS gl_accounts_origin_check;

ALTER TABLE public.gl_accounts
  ADD CONSTRAINT gl_accounts_type_check CHECK (type IN ('SINTETICA', 'ANALITICA')),
  ADD CONSTRAINT gl_accounts_nature_check CHECK (nature IN ('RECEITA', 'DEDUCAO', 'CUSTO', 'DESPESA', 'FINANCEIRO')),
  ADD CONSTRAINT gl_accounts_origin_check CHECK (origin IN ('SYSTEM', 'PRODUCT_CATEGORY', 'FINANCIAL_CATEGORY', 'MANUAL'));

-- 4) Garantir unique canonical usada pelo ON CONFLICT do seed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.gl_accounts'::regclass
      AND contype = 'u'
      AND conname = 'gl_accounts_code_company_unique'
  ) THEN
    ALTER TABLE public.gl_accounts
      ADD CONSTRAINT gl_accounts_code_company_unique UNIQUE (company_id, code);
  END IF;
END $$;

-- 5) Recriar função canônica de seed
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

  WITH p AS (
    INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '3.1', 'CPV Produtos Acabados', 'SINTETICA', 'CUSTO', true, 'SYSTEM', v_root_custo)
    ON CONFLICT ON CONSTRAINT gl_accounts_code_company_unique
    DO UPDATE SET is_system_locked = true, origin = 'SYSTEM', parent_id = v_root_custo
    RETURNING id
  )
  INSERT INTO public.gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
  VALUES (p_company_id, '3.1.01', 'Custo Médio das Mercadorias Vendidas', 'ANALITICA', 'CUSTO', true, 'SYSTEM', (SELECT id FROM p))
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

REVOKE ALL ON FUNCTION public.seed_chart_spine(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_chart_spine(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_chart_spine(uuid) TO service_role;
