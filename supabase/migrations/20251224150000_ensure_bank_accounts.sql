
-- Ensure Company Settings columns exist
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS default_penalty_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_interest_percent NUMERIC(5,2) DEFAULT 0;

-- Ensure Company Bank Accounts table exists
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

-- RLS
ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'company_bank_accounts' AND policyname = 'Tenant read bank accounts'
    ) THEN
        CREATE POLICY "Tenant read bank accounts" ON public.company_bank_accounts
            FOR SELECT TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM public.company_members 
                    WHERE company_id = public.company_bank_accounts.company_id 
                    AND auth_user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'company_bank_accounts' AND policyname = 'Tenant write bank accounts'
    ) THEN
        CREATE POLICY "Tenant write bank accounts" ON public.company_bank_accounts
            FOR ALL TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM public.company_members 
                    WHERE company_id = public.company_bank_accounts.company_id 
                    AND auth_user_id = auth.uid()
                    AND role IN ('owner', 'admin')
                )
            );
    END IF;
END $$;
