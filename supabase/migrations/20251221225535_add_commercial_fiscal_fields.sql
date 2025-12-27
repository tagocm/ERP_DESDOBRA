
-- Migration: Add Commercial and Fiscal Fields to Organizations
-- Adds fields required for commercial terms and fiscal compliance

-- 1) Add commercial fields
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS price_table_id UUID,
ADD COLUMN IF NOT EXISTS sales_rep_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS freight_terms TEXT CHECK (freight_terms IN ('cif', 'fob', 'retira', 'combinar')),
ADD COLUMN IF NOT EXISTS notes_commercial TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2) Add fiscal fields
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS is_simple_national BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_public_agency BOOLEAN NOT NULL DEFAULT false;

-- 3) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_price_table 
ON public.organizations(price_table_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_sales_rep 
ON public.organizations(sales_rep_user_id) WHERE deleted_at IS NULL;

-- 4) Comments for documentation
COMMENT ON COLUMN public.organizations.is_simple_national IS 'Indicates if organization is under Simples Nacional tax regime';
COMMENT ON COLUMN public.organizations.is_public_agency IS 'Indicates if organization is a public agency';
COMMENT ON COLUMN public.organizations.freight_terms IS 'Default freight terms: CIF, FOB, Retira, or A Combinar';
COMMENT ON COLUMN public.organizations.price_table_id IS 'Default price table for this organization (future feature)';
COMMENT ON COLUMN public.organizations.sales_rep_user_id IS 'Sales representative assigned to this organization';
COMMENT ON COLUMN public.organizations.email IS 'General contact email for the organization';
COMMENT ON COLUMN public.organizations.notes_commercial IS 'Commercial notes and observations';
