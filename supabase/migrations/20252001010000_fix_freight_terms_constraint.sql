-- Migration: Fix freight_terms constraint
-- Add missing 'sem_frete' option to freight_terms check constraint

-- Drop existing constraint
ALTER TABLE public.organizations 
DROP CONSTRAINT IF EXISTS organizations_freight_terms_check;

-- Add updated constraint with all valid values
ALTER TABLE public.organizations
ADD CONSTRAINT organizations_freight_terms_check 
CHECK (freight_terms IN ('cif', 'fob', 'retira', 'combinar', 'sem_frete'));

-- Update comment
COMMENT ON COLUMN public.organizations.freight_terms IS 'Default freight terms: CIF, FOB, Retira, Combinar, or Sem Frete';
