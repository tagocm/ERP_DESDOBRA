-- Migration: Add Origin State to Fiscal Operations
-- Description: Adds `uf_origem` to link operations to Company State, enabling Pattern B (Origin-based rules).

-- 1. Add column with default "SP" for easy migration of existing data
ALTER TABLE public.fiscal_operations
ADD COLUMN IF NOT EXISTS uf_origem CHAR(2) NOT NULL DEFAULT 'SP';

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_fiscal_operations_uf_origem ON public.fiscal_operations(uf_origem);

-- 3. Comment
COMMENT ON COLUMN public.fiscal_operations.uf_origem IS 'UF of the Organization (Issuer) at creation time. Used to filter rules by Origin context.';
