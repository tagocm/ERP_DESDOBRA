-- Migration: Create Recurring Rules Table (Restored)
-- Description: Creates the recurring_rules table which was missing but referenced by subsequent migrations.
-- Timestamp: 20260202180000 (Set before 183000)

BEGIN;

CREATE TABLE IF NOT EXISTS public.recurring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id),
    
    -- Basic Info
    name TEXT NOT NULL,
    partner_name TEXT,
    partner_id UUID, -- References public.entities(id) but table might not exist yet
    description TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'ENCERRADO', 'RASCUNHO')),
    
    -- Legacy Fields (Required for refactor migration 190000)
    rule_type TEXT CHECK (rule_type IN ('FIXO', 'VARIAVEL')),
    due_day INTEGER,
    start_month TEXT, -- YYYY-MM
    end_month TEXT,   -- YYYY-MM
    amount NUMERIC(15,2),
    auto_generate BOOLEAN DEFAULT true,
    category TEXT, -- Legacy category string
    
    -- Optional fields that might be used
    cost_center_id UUID, -- References public.financial_cost_centers(id) but table might not exist yet

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_rules_company_id ON public.recurring_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_status ON public.recurring_rules(status);

-- RLS
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'recurring_rules' 
        AND policyname = 'Tenant read access'
    ) THEN
        CREATE POLICY "Tenant read access" ON public.recurring_rules 
        FOR SELECT TO authenticated 
        USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_recurring_rules_updated_at ON public.recurring_rules;
        CREATE TRIGGER update_recurring_rules_updated_at
            BEFORE UPDATE ON public.recurring_rules
            FOR EACH ROW
            EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

COMMIT;
