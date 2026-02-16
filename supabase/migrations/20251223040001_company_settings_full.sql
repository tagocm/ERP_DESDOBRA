-- Add Branch Support to Companies
ALTER TABLE public.companies
ADD COLUMN parent_company_id UUID REFERENCES public.companies(id),
ADD COLUMN is_branch BOOLEAN DEFAULT false;

-- Enhance Company Settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS cert_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS is_cert_password_saved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS default_penalty_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_interest_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS city_code_ibge TEXT,
ADD COLUMN IF NOT EXISTS nfe_flags JSONB DEFAULT '{}'::jsonb;

-- Company Bank Accounts
CREATE TABLE IF NOT EXISTS public.company_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    bank_code TEXT,
    agency TEXT,
    account_number TEXT,
    account_type TEXT CHECK (account_type IN ('corrente', 'poupanca', 'pagamento', 'outra')),
    pix_key TEXT,
    pix_type TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Company Payment Terms Settings (Accepted Terms)
CREATE TABLE IF NOT EXISTS public.company_payment_terms_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    term_type TEXT CHECK (term_type IN ('vista', 'prazo')),
    installments INTEGER DEFAULT 1,
    days_first_installment INTEGER DEFAULT 0,
    cadence_days INTEGER, -- e.g. 30 (for 30/60/90)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for new tables
ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_payment_terms_settings ENABLE ROW LEVEL SECURITY;

-- Policies for Bank Accounts
CREATE POLICY "Tenant read bank accounts" ON public.company_bank_accounts
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.company_members 
            WHERE company_id = public.company_bank_accounts.company_id 
            AND auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Tenant write bank accounts" ON public.company_bank_accounts
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.company_members 
            WHERE company_id = public.company_bank_accounts.company_id 
            AND auth_user_id = auth.uid()
            AND role IN ('owner', 'admin') -- Only admin/owner
        )
    );

-- Policies for Payment Terms
CREATE POLICY "Tenant read payment terms" ON public.company_payment_terms_settings
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.company_members 
            WHERE company_id = public.company_payment_terms_settings.company_id 
            AND auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Tenant write payment terms" ON public.company_payment_terms_settings
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.company_members 
            WHERE company_id = public.company_payment_terms_settings.company_id 
            AND auth_user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- Triggers for updated_at
CREATE TRIGGER update_company_bank_accounts_updated_at
    BEFORE UPDATE ON public.company_bank_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_payment_terms_settings_updated_at
    BEFORE UPDATE ON public.company_payment_terms_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
