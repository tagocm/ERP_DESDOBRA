-- Migration: Add Fiscal Snapshot Columns to Sales Document Items
-- Description: Adds columns to store fiscal calculations and snapshots directly on the order item.

ALTER TABLE public.sales_document_items
ADD COLUMN IF NOT EXISTS ncm_snapshot TEXT,
ADD COLUMN IF NOT EXISTS cest_snapshot TEXT,
ADD COLUMN IF NOT EXISTS origin_snapshot INT,

ADD COLUMN IF NOT EXISTS fiscal_status TEXT DEFAULT 'pending', 
ADD COLUMN IF NOT EXISTS fiscal_operation_id UUID, -- Optional FK to fiscal_operations if it exists
ADD COLUMN IF NOT EXISTS cfop_code TEXT,

ADD COLUMN IF NOT EXISTS cst_icms TEXT,
ADD COLUMN IF NOT EXISTS csosn TEXT,
ADD COLUMN IF NOT EXISTS st_applies BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS st_aliquot NUMERIC(10, 4),
ADD COLUMN IF NOT EXISTS st_value NUMERIC(15, 2),

ADD COLUMN IF NOT EXISTS pis_cst TEXT,
ADD COLUMN IF NOT EXISTS pis_aliquot NUMERIC(10, 4),
ADD COLUMN IF NOT EXISTS pis_value NUMERIC(15, 2),

ADD COLUMN IF NOT EXISTS cofins_cst TEXT,
ADD COLUMN IF NOT EXISTS cofins_aliquot NUMERIC(10, 4),
ADD COLUMN IF NOT EXISTS cofins_value NUMERIC(15, 2),

ADD COLUMN IF NOT EXISTS ipi_applies BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ipi_cst TEXT,
ADD COLUMN IF NOT EXISTS ipi_aliquot NUMERIC(10, 4),
ADD COLUMN IF NOT EXISTS ipi_value NUMERIC(15, 2),

ADD COLUMN IF NOT EXISTS fiscal_notes TEXT;

-- Index for valid fiscal operations lookup if needed
CREATE INDEX IF NOT EXISTS idx_sales_items_fiscal_op ON public.sales_document_items(fiscal_operation_id);

NOTIFY pgrst, 'reload schema';
