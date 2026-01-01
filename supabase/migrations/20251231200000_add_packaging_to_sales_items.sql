-- Add packaging_id to sales_document_items
ALTER TABLE public.sales_document_items 
ADD COLUMN IF NOT EXISTS packaging_id UUID REFERENCES public.item_packaging(id);

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_sales_items_packaging ON public.sales_document_items(packaging_id);
