-- Add fiscal calculation fields to sales_document_items
-- This enables the fiscal engine to store resolved tax rules per item

ALTER TABLE public.sales_document_items
ADD COLUMN IF NOT EXISTS fiscal_operation_id UUID REFERENCES public.fiscal_operations(id),
ADD COLUMN IF NOT EXISTS cfop_code VARCHAR(4),
ADD COLUMN IF NOT EXISTS cst_icms VARCHAR(3),
ADD COLUMN IF NOT EXISTS csosn VARCHAR(4),
ADD COLUMN IF NOT EXISTS st_applies BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS st_base_calc NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS st_aliquot NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS st_value NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS pis_cst VARCHAR(2),
ADD COLUMN IF NOT EXISTS pis_aliquot NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS pis_value NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS cofins_cst VARCHAR(2),
ADD COLUMN IF NOT EXISTS cofins_aliquot NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS cofins_value NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS ipi_applies BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ipi_cst VARCHAR(2),
ADD COLUMN IF NOT EXISTS ipi_aliquot NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS ipi_value NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS fiscal_notes TEXT,
ADD COLUMN IF NOT EXISTS fiscal_status TEXT DEFAULT 'pending' CHECK (fiscal_status IN ('pending', 'calculated', 'no_rule_found', 'manual')),
-- Snapshot fields for audit trail
ADD COLUMN IF NOT EXISTS ncm_snapshot VARCHAR(8),
ADD COLUMN IF NOT EXISTS cest_snapshot VARCHAR(7),
ADD COLUMN IF NOT EXISTS origin_snapshot INTEGER;

-- Create index on fiscal_operation_id for lookups
CREATE INDEX IF NOT EXISTS idx_sales_items_fiscal_op ON public.sales_document_items(fiscal_operation_id);

-- Create index on fiscal_status for filtering
CREATE INDEX IF NOT EXISTS idx_sales_items_fiscal_status ON public.sales_document_items(fiscal_status);

COMMENT ON COLUMN public.sales_document_items.fiscal_operation_id IS 'Reference to the fiscal operation rule applied to this item';
COMMENT ON COLUMN public.sales_document_items.fiscal_status IS 'Status of fiscal calculation: pending, calculated, no_rule_found, manual';
COMMENT ON COLUMN public.sales_document_items.ncm_snapshot IS 'NCM code at time of order creation (audit trail)';
COMMENT ON COLUMN public.sales_document_items.cest_snapshot IS 'CEST code at time of order creation (audit trail)';
COMMENT ON COLUMN public.sales_document_items.origin_snapshot IS 'Product origin at time of order creation (audit trail)';
