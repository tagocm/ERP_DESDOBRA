-- ========================================================================
-- FINANCIAL MVP: Cost Centers & Chart of Accounts
-- ========================================================================

-- 1. Create Chart of Accounts (Plano de Contas Simplificado)
CREATE TABLE IF NOT EXISTS public.gl_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, code)
);

ALTER TABLE public.gl_accounts ENABLE ROW LEVEL SECURITY;

-- 2. Create Cost Centers (Centros de Custo)
CREATE TABLE IF NOT EXISTS public.cost_centers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL,
    code TEXT,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

-- 3. Add Columns to Organizations (Defaults for Suppliers)
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS default_account_id UUID REFERENCES public.gl_accounts(id),
ADD COLUMN IF NOT EXISTS default_cost_center_id UUID REFERENCES public.cost_centers(id);

-- 4. Add Columns to Official Titles (Pass-through target)
ALTER TABLE public.ar_installments
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.gl_accounts(id),
ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id);

ALTER TABLE public.ap_installments
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.gl_accounts(id),
ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id);

-- 5. RLS Policies
-- GL Accounts
DROP POLICY IF EXISTS "Users can view accounts of their company" ON public.gl_accounts;
CREATE POLICY "Users can view accounts of their company" ON public.gl_accounts
    FOR ALL USING (company_id IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    ));

-- Cost Centers
DROP POLICY IF EXISTS "Users can view cost centers of their company" ON public.cost_centers;
CREATE POLICY "Users can view cost centers of their company" ON public.cost_centers
    FOR ALL USING (company_id IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    ));

-- 6. Trigger for Updated At
CREATE OR REPLACE TRIGGER update_gl_accounts_modtime
    BEFORE UPDATE ON public.gl_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_cost_centers_modtime
    BEFORE UPDATE ON public.cost_centers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Seed Data Logic (Run for all existing companies)
DO $$
DECLARE
    r_company RECORD;
BEGIN
    FOR r_company IN SELECT id FROM companies
    LOOP
        -- Create Default "Receita - Mercadoria Vendida"
        INSERT INTO public.gl_accounts (company_id, code, name, type)
        VALUES (r_company.id, '3.01.01', 'Receita de Venda de Mercadorias', 'REVENUE')
        ON CONFLICT (company_id, code) DO NOTHING;

        -- Create Default "Custo - Mercadoria Vendida" (CMV) (Optional but good for generic usage)
        INSERT INTO public.gl_accounts (company_id, code, name, type)
        VALUES (r_company.id, '4.01.01', 'Custo das Mercadorias Vendidas', 'EXPENSE')
        ON CONFLICT (company_id, code) DO NOTHING;
        
        -- Create Default "Despesas Gerais"
        INSERT INTO public.gl_accounts (company_id, code, name, type)
        VALUES (r_company.id, '5.01.01', 'Despesas Administrativas Gerais', 'EXPENSE')
        ON CONFLICT (company_id, code) DO NOTHING;

        -- Create Default "Geral" Cost Center
        INSERT INTO public.cost_centers (company_id, code, name)
        VALUES (r_company.id, '001', 'Geral')
        ON CONFLICT DO NOTHING; -- No unique constraint on code yet, but safe to insert
    END LOOP;
END $$;
