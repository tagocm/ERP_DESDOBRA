-- Add sales_unit_snapshot to sales_document_items
-- This column will store a snapshot of the unit used at the time of sale
ALTER TABLE sales_document_items
ADD COLUMN sales_unit_snapshot JSONB NULL;

COMMENT ON COLUMN sales_document_items.sales_unit_snapshot IS 'Snapshot da unidade de venda/logística (ex: Caixa 12xPc) para integridade histórica';
