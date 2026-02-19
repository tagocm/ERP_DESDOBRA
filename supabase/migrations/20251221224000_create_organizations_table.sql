-- Migration: Create Organizations Table (Foundation)
-- Description: Creates the base organizations table required by subsequent migrations.
-- Timestamp: 20251221224000 (Set to run before 20251221225535)

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    
    -- Core Identity
    document_number TEXT,
    document_type TEXT,
    legal_name TEXT,
    trade_name TEXT NOT NULL,
    
    -- Registration
    state_registration TEXT,
    municipal_registration TEXT,
    
    -- Status & Metadata
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    
    -- Commercial (Basic)
    default_payment_terms_days INTEGER,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_company_id ON public.organizations(company_id);
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON public.organizations(deleted_at);

-- 3. Triggers (updated_at)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
        CREATE TRIGGER update_organizations_updated_at
            BEFORE UPDATE ON public.organizations
            FOR EACH ROW
            EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- 4. RLS (Enable Security)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 5. Basic Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'organizations' 
        AND policyname = 'Enable read for authenticated users'
    ) THEN
        CREATE POLICY "Enable read for authenticated users" ON public.organizations FOR SELECT TO authenticated USING (true);
    END IF;
END $$;
