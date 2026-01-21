-- Migration: Add missing columns to company_settings
-- Description: Adds legal_name, trade_name, cnpj, ie, im, cnae fields, and address fields to company_settings.

ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS legal_name text,
ADD COLUMN IF NOT EXISTS trade_name text,
ADD COLUMN IF NOT EXISTS cnpj text,
ADD COLUMN IF NOT EXISTS ie text,
ADD COLUMN IF NOT EXISTS im text,
ADD COLUMN IF NOT EXISTS cnae_code text,
ADD COLUMN IF NOT EXISTS cnae_description text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS whatsapp text,
ADD COLUMN IF NOT EXISTS instagram text,

-- Address
ADD COLUMN IF NOT EXISTS address_zip text,
ADD COLUMN IF NOT EXISTS address_street text,
ADD COLUMN IF NOT EXISTS address_number text,
ADD COLUMN IF NOT EXISTS address_complement text,
ADD COLUMN IF NOT EXISTS address_neighborhood text,
ADD COLUMN IF NOT EXISTS address_city text,
ADD COLUMN IF NOT EXISTS address_state text,
ADD COLUMN IF NOT EXISTS address_country text DEFAULT 'Brasil',
ADD COLUMN IF NOT EXISTS city_code_ibge text,

-- Fiscal
ADD COLUMN IF NOT EXISTS tax_regime text,
ADD COLUMN IF NOT EXISTS fiscal_doc_model integer DEFAULT 55,
ADD COLUMN IF NOT EXISTS nfe_environment text DEFAULT 'homologation',
ADD COLUMN IF NOT EXISTS nfe_series text DEFAULT '1',
ADD COLUMN IF NOT EXISTS nfe_next_number integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS nfe_flags jsonb DEFAULT '{}',

-- Finance
ADD COLUMN IF NOT EXISTS default_penalty_percent numeric(5,2) DEFAULT 2.00,
ADD COLUMN IF NOT EXISTS default_interest_percent numeric(5,2) DEFAULT 1.00;
