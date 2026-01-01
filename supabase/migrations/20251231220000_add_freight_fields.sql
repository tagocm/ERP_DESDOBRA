
-- Add Freight and Logistics fields to Sales Documents
ALTER TABLE public.sales_documents
ADD COLUMN IF NOT EXISTS route_tag TEXT,
ADD COLUMN IF NOT EXISTS shipping_notes TEXT;

COMMENT ON COLUMN public.sales_documents.route_tag IS 'Region or Route tag derived from Client or manually set';
COMMENT ON COLUMN public.sales_documents.shipping_notes IS 'Specific notes for shipping/logistics';
