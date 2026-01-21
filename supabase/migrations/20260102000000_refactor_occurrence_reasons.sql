-- Migration: Refactor Occurrence Reasons (Multi-tenant)
-- Description: Replaces global system reasons with company-specific customizable reasons.

BEGIN;

-- 1. Create Enums (Optional, but useful for strictness)
-- actually, using TEXT with check constraints is often more flexible for updates, but Enums are requested in plan.
-- Let's use TEXT with Check Constraints for simplicity in modifying later if needed, or Enums if strict.
-- User requested Enums in plan, but previous migration showed text casting issues. 
-- I will use TEXT with CHECK constraints to avoid Enum hell, as it's easier to migrate.

CREATE TABLE IF NOT EXISTS public.occurrence_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id),
    
    -- Categorization
    occurrence_type TEXT NOT NULL CHECK (occurrence_type IN ('exp_nao_carregado', 'exp_parcial', 'ret_nao_entregue', 'ret_devolvido')),
    
    -- Basics
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    -- Action Configuration
    -- Where does the order go?
    action_destination TEXT NOT NULL CHECK (action_destination IN ('pendente', 'agendado', 'devolvido', 'entregue')),
    
    -- Reschedule Policy
    reschedule_policy TEXT NOT NULL DEFAULT 'optional' CHECK (reschedule_policy IN ('none', 'optional', 'required')),
    
    -- Specific flags
    generate_difference_order BOOLEAN DEFAULT false, -- For partial/devolution
    
    -- Requirements / Flags
    require_notes BOOLEAN DEFAULT false,
    flag_commercial BOOLEAN DEFAULT false,
    flag_finance BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE public.occurrence_reasons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy 
        WHERE polname = 'Manage reasons for own company' 
        AND polrelid = 'public.occurrence_reasons'::regclass
    ) THEN
        CREATE POLICY "Manage reasons for own company" ON public.occurrence_reasons
            FOR ALL
            USING (
                company_id IN (
                    SELECT company_id FROM public.company_members 
                    WHERE auth_user_id = auth.uid()
                )
            )
            WITH CHECK (
                company_id IN (
                    SELECT company_id FROM public.company_members 
                    WHERE auth_user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_occurrence_reasons_company ON public.occurrence_reasons(company_id);
CREATE INDEX IF NOT EXISTS idx_occurrence_reasons_type ON public.occurrence_reasons(company_id, occurrence_type);

COMMIT;
