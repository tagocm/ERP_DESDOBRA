-- Add Fiscal Fields to Organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS ie_indicator TEXT CHECK (ie_indicator IN ('contributor', 'exempt', 'non_contributor')),
ADD COLUMN IF NOT EXISTS municipal_registration TEXT,
ADD COLUMN IF NOT EXISTS is_simple_national BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_public_agency BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suframa TEXT,
ADD COLUMN IF NOT EXISTS email_nfe TEXT,
ADD COLUMN IF NOT EXISTS final_consumer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS icms_contributor BOOLEAN DEFAULT false; -- Derived from ie_indicator, but persisted for queries

-- Add IBGE Code to Addresses
ALTER TABLE public.addresses
ADD COLUMN IF NOT EXISTS city_code_ibge TEXT;

-- Validation Trigger (Optional, but good for data quality)
-- For now, application-level validation is sufficient as per request focus on 'Blocking Save' in UI.
