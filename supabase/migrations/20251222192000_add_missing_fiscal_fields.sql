-- Migration: Add Missing Fiscal Fields to Organizations
-- Created a fix for: "Could not find the 'default_cfop' column" error

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS tax_regime TEXT, -- Simples Nacional, Lucro Presumido, Real...
    ADD COLUMN IF NOT EXISTS is_ie_exempt BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_final_consumer BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS public_agency_sphere TEXT, -- Federal, Estadual, Municipal
    ADD COLUMN IF NOT EXISTS public_agency_code TEXT,
    ADD COLUMN IF NOT EXISTS default_operation_nature TEXT,
    ADD COLUMN IF NOT EXISTS default_cfop TEXT,
    ADD COLUMN IF NOT EXISTS notes_fiscal TEXT,
    ADD COLUMN IF NOT EXISTS icms_contributor TEXT; -- Contribuinte, Não Contribuinte, Isento (can be stored as text or enum, text for flexibility now)

-- Add comments for clarity
COMMENT ON COLUMN public.organizations.default_cfop IS 'Default CFOP code for sales to this organization';
COMMENT ON COLUMN public.organizations.tax_regime IS 'Tax regime of the organization (e.g. Simples Nacional)';
