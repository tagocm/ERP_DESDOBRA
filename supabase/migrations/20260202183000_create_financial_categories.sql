-- Migration: Create Financial Categories table
-- Purpose: Allow users to manage categories for Recurring Rules (Fatos Geradores) and general financial classification.

CREATE TABLE IF NOT EXISTS public.financial_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Unique constraint per company for active categories
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_categories_name_company 
ON public.financial_categories(company_id, name) 
WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant read access" ON public.financial_categories;
CREATE POLICY "Tenant read access" ON public.financial_categories
    FOR SELECT TO authenticated 
    USING (is_member_of(company_id));

DROP POLICY IF EXISTS "Tenant write access" ON public.financial_categories;
CREATE POLICY "Tenant write access" ON public.financial_categories
    FOR ALL TO authenticated 
    USING (is_member_of(company_id)) 
    WITH CHECK (is_member_of(company_id));

-- Triggers
DROP TRIGGER IF EXISTS update_financial_categories_updated_at ON public.financial_categories;
CREATE TRIGGER update_financial_categories_updated_at
    BEFORE UPDATE ON public.financial_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add category_id to recurring_rules
ALTER TABLE public.recurring_rules 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.financial_categories(id);

-- Optional: Backfill logic could go here if we had data, currently assuming new feature or manual migration.
