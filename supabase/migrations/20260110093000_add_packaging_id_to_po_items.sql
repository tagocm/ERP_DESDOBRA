-- Add packaging_id column to purchase_order_items
ALTER TABLE public.purchase_order_items
ADD COLUMN packaging_id UUID REFERENCES public.item_packaging(id) ON DELETE SET NULL;

-- Comment on column
COMMENT ON COLUMN public.purchase_order_items.packaging_id IS 'Reference to the specific packaging used (if any). Used to restore UI state.';
