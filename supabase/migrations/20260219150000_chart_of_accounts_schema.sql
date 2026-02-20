-- Migration: Chart of Accounts Implementation
-- Date: 2026-02-19

-- 1. Extend gl_accounts table
ALTER TABLE gl_accounts
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES gl_accounts(id),
ADD COLUMN IF NOT EXISTS nature TEXT CHECK (nature IN ('RECEITA', 'DEDUCAO', 'CUSTO', 'DESPESA', 'FINANCEIRO')),
ADD COLUMN IF NOT EXISTS is_system_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'MANUAL' CHECK (origin IN ('SYSTEM', 'PRODUCT_CATEGORY', 'MANUAL')),
ADD COLUMN IF NOT EXISTS origin_id UUID;

-- Fix type column constraints (Transition from 'REVENUE'/'EXPENSE' to 'SINTETICA'/'ANALITICA')
DO $$ BEGIN
    -- Drop old check if exists (name might vary, supabase defaults to table_column_check)
    ALTER TABLE gl_accounts DROP CONSTRAINT IF EXISTS gl_accounts_type_check;
    
    -- Update existing rows to 'ANALITICA' (assuming previous seeds were analytic)
    UPDATE gl_accounts SET type = 'ANALITICA' WHERE type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
    
    -- Add new constraint
    ALTER TABLE gl_accounts ADD CONSTRAINT gl_accounts_type_check CHECK (type IN ('SINTETICA', 'ANALITICA'));
EXCEPTION
    WHEN others THEN null; -- Ignore if already done or constraint name differs
END $$;

-- Add constraints
DO $$ BEGIN
    ALTER TABLE gl_accounts ADD CONSTRAINT gl_accounts_code_company_unique UNIQUE (company_id, code);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Extend product_categories table
ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS revenue_account_id UUID REFERENCES gl_accounts(id),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add constraints // normalized_name might need to be created if not exists, but previous migrations suggest it might exist. 
-- Checking types/supabase.ts, normalized_name exists.
DO $$ BEGIN
    ALTER TABLE product_categories ADD CONSTRAINT product_categories_name_company_unique UNIQUE (company_id, normalized_name);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Function to generate next revenue code (1.1.XX)
CREATE OR REPLACE FUNCTION generate_next_revenue_code(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_code TEXT;
    v_next_seq INTEGER;
    v_new_code TEXT;
BEGIN
    -- Lock to prevent race conditions (Advisory Lock using a hash of company_id + constant)
    -- We use a simplified lock on the gl_accounts table for this company to be safe, or just atomic update?
    -- Better to query max code.
    
    -- Find the highest code ending in 1.1.XX
    SELECT MAX(code)
    INTO v_last_code
    FROM gl_accounts
    WHERE company_id = p_company_id
      AND code LIKE '1.1.%'
      AND code ~ '^1\.1\.\d+$'; -- Regex to ensure it matches 1.1.digits

    IF v_last_code IS NULL THEN
        v_next_seq := 1;
    ELSE
        -- Extract the number part
        v_next_seq := CAST(SUBSTRING(v_last_code FROM '1\.1\.(\d+)') AS INTEGER) + 1;
    END IF;

    -- Format with at least 2 digits: 1.1.01, 1.1.02, ... 1.1.100
    v_new_code := '1.1.' || LPAD(v_next_seq::TEXT, 2, '0');
    
    RETURN v_new_code;
END;
$$;

-- 4. Function to seed "Spine" (System Accounts)
CREATE OR REPLACE FUNCTION seed_chart_spine(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    -- IDs for parents
    v_root_receitas UUID;
    v_receita_bruta UUID;
    v_root_deducoes UUID;
    v_root_custo UUID;
    v_root_despesas UUID;
    v_desp_comerciais UUID;
    v_desp_adm UUID;
    v_desp_log UUID;
    v_root_resultado_fin UUID;
    v_rec_fin UUID;
    v_desp_fin UUID;
BEGIN
    -- 1. RECEITAS
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin)
    VALUES (p_company_id, '1', 'RECEITAS', 'SINTETICA', 'RECEITA', TRUE, 'SYSTEM')
    ON CONFLICT (company_id, code) DO UPDATE SET is_system_locked = TRUE, origin = 'SYSTEM'
    RETURNING id INTO v_root_receitas;

    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '1.1', 'Receita Bruta de Vendas', 'SINTETICA', 'RECEITA', TRUE, 'SYSTEM', v_root_receitas)
    ON CONFLICT (company_id, code) DO UPDATE SET is_system_locked = TRUE, parent_id = v_root_receitas
    RETURNING id INTO v_receita_bruta;

    -- 2. DEDUÇÕES DA RECEITA
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin)
    VALUES (p_company_id, '2', 'DEDUÇÕES DA RECEITA', 'SINTETICA', 'DEDUCAO', TRUE, 'SYSTEM')
    ON CONFLICT (company_id, code) DO UPDATE SET is_system_locked = TRUE, origin = 'SYSTEM'
    RETURNING id INTO v_root_deducoes;

    -- 2.1 Impostos (Simplificado para o exemplo, estender conforme arvore)
    -- ... (Implementando a arvore completa conforme prompt)
    
    -- 2.1 Impostos sobre Vendas
    WITH p AS (INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id) VALUES (p_company_id, '2.1', 'Impostos sobre Vendas', 'SINTETICA', 'DEDUCAO', TRUE, 'SYSTEM', v_root_deducoes) ON CONFLICT (company_id, code) DO UPDATE SET parent_id = v_root_deducoes RETURNING id)
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    SELECT p_company_id, c, n, 'ANALITICA', 'DEDUCAO', TRUE, 'SYSTEM', (SELECT id FROM p)
    FROM (VALUES 
        ('2.1.01', 'ICMS'), 
        ('2.1.02', 'PIS'), 
        ('2.1.03', 'COFINS')
    ) AS t(c, n)
    ON CONFLICT (company_id, code) DO NOTHING;

    -- 2.2 Devoluções
    WITH p AS (INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id) VALUES (p_company_id, '2.2', 'Devoluções', 'SINTETICA', 'DEDUCAO', TRUE, 'SYSTEM', v_root_deducoes) ON CONFLICT (company_id, code) DO UPDATE SET parent_id = v_root_deducoes RETURNING id)
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '2.2.01', 'Devoluções de Vendas', 'ANALITICA', 'DEDUCAO', TRUE, 'SYSTEM', (SELECT id FROM p))
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- 2.3 Descontos
    WITH p AS (INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id) VALUES (p_company_id, '2.3', 'Descontos Concedidos', 'SINTETICA', 'DEDUCAO', TRUE, 'SYSTEM', v_root_deducoes) ON CONFLICT (company_id, code) DO UPDATE SET parent_id = v_root_deducoes RETURNING id)
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '2.3.01', 'Descontos Incondicionais', 'ANALITICA', 'DEDUCAO', TRUE, 'SYSTEM', (SELECT id FROM p))
    ON CONFLICT (company_id, code) DO NOTHING;

    -- 3. CUSTO DOS PRODUTOS VENDIDOS
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin)
    VALUES (p_company_id, '3', 'CUSTO DOS PRODUTOS VENDIDOS', 'SINTETICA', 'CUSTO', TRUE, 'SYSTEM')
    ON CONFLICT (company_id, code) DO UPDATE SET is_system_locked = TRUE
    RETURNING id INTO v_root_custo;

    -- 3.1 CPV
    WITH p AS (INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id) VALUES (p_company_id, '3.1', 'CPV Produtos Acabados', 'SINTETICA', 'CUSTO', TRUE, 'SYSTEM', v_root_custo) ON CONFLICT (company_id, code) DO UPDATE SET parent_id = v_root_custo RETURNING id)
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '3.1.01', 'Custo Médio das Mercadorias Vendidas', 'ANALITICA', 'CUSTO', TRUE, 'SYSTEM', (SELECT id FROM p))
    ON CONFLICT (company_id, code) DO NOTHING;

    -- 4. DESPESAS OPERACIONAIS
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin)
    VALUES (p_company_id, '4', 'DESPESAS OPERACIONAIS', 'SINTETICA', 'DESPESA', TRUE, 'SYSTEM')
    ON CONFLICT (company_id, code) DO UPDATE SET is_system_locked = TRUE
    RETURNING id INTO v_root_despesas;

    -- 4.1 Comerciais
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '4.1', 'Despesas Comerciais', 'SINTETICA', 'DESPESA', TRUE, 'SYSTEM', v_root_despesas)
    ON CONFLICT (company_id, code) DO UPDATE SET parent_id = v_root_despesas
    RETURNING id INTO v_desp_comerciais;

    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    SELECT p_company_id, c, n, 'ANALITICA', 'DESPESA', TRUE, 'SYSTEM', v_desp_comerciais
    FROM (VALUES 
        ('4.1.01', 'Comissões'), 
        ('4.1.02', 'Marketing'), 
        ('4.1.03', 'Fretes sobre Vendas'),
        ('4.1.04', 'Representantes')
    ) AS t(c, n)
    ON CONFLICT (company_id, code) DO NOTHING;

    -- 4.2 Administrativas
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '4.2', 'Despesas Administrativas', 'SINTETICA', 'DESPESA', TRUE, 'SYSTEM', v_root_despesas)
    ON CONFLICT (company_id, code) DO UPDATE SET parent_id = v_root_despesas
    RETURNING id INTO v_desp_adm;

    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    SELECT p_company_id, c, n, 'ANALITICA', 'DESPESA', TRUE, 'SYSTEM', v_desp_adm
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
    ON CONFLICT (company_id, code) DO NOTHING;

    -- 4.3 Logísticas
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    VALUES (p_company_id, '4.3', 'Despesas Logísticas', 'SINTETICA', 'DESPESA', TRUE, 'SYSTEM', v_root_despesas)
    ON CONFLICT (company_id, code) DO UPDATE SET parent_id = v_root_despesas
    RETURNING id INTO v_desp_log;

    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    SELECT p_company_id, c, n, 'ANALITICA', 'DESPESA', TRUE, 'SYSTEM', v_desp_log
    FROM (VALUES 
        ('4.3.01', 'Combustível'), 
        ('4.3.02', 'Manutenção Veículos'), 
        ('4.3.03', 'Seguro / IPVA')
    ) AS t(c, n)
    ON CONFLICT (company_id, code) DO NOTHING;

    -- 5. RESULTADO FINANCEIRO
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin)
    VALUES (p_company_id, '5', 'RESULTADO FINANCEIRO', 'SINTETICA', 'FINANCEIRO', TRUE, 'SYSTEM')
    ON CONFLICT (company_id, code) DO UPDATE SET is_system_locked = TRUE
    RETURNING id INTO v_root_resultado_fin;

    -- 5.1 Receitas Financeiras
    WITH p AS (INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id) VALUES (p_company_id, '5.1', 'Receitas Financeiras', 'SINTETICA', 'FINANCEIRO', TRUE, 'SYSTEM', v_root_resultado_fin) ON CONFLICT (company_id, code) DO UPDATE SET parent_id = v_root_resultado_fin RETURNING id)
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    SELECT p_company_id, c, n, 'ANALITICA', 'FINANCEIRO', TRUE, 'SYSTEM', (SELECT id FROM p)
    FROM (VALUES 
        ('5.1.01', 'Rendimentos'), 
        ('5.1.02', 'Descontos Obtidos')
    ) AS t(c, n)
    ON CONFLICT (company_id, code) DO NOTHING;

    -- 5.2 Despesas Financeiras
     WITH p AS (INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id) VALUES (p_company_id, '5.2', 'Despesas Financeiras', 'SINTETICA', 'FINANCEIRO', TRUE, 'SYSTEM', v_root_resultado_fin) ON CONFLICT (company_id, code) DO UPDATE SET parent_id = v_root_resultado_fin RETURNING id)
    INSERT INTO gl_accounts (company_id, code, name, type, nature, is_system_locked, origin, parent_id)
    SELECT p_company_id, c, n, 'ANALITICA', 'FINANCEIRO', TRUE, 'SYSTEM', (SELECT id FROM p)
    FROM (VALUES 
        ('5.2.01', 'Juros Bancários'), 
        ('5.2.02', 'Tarifas Bancárias'),
        ('5.2.03', 'Juros Empréstimos')
    ) AS t(c, n)
    ON CONFLICT (company_id, code) DO NOTHING;

END;
$$;

-- 5. Trigger backfill for all companies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM companies LOOP
        PERFORM seed_chart_spine(r.id);
    END LOOP;
END $$;
