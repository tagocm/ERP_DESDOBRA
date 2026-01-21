-- Add payment and logic fields to purchase_orders to match sales_orders structure
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS payment_terms_id UUID REFERENCES public.payment_terms(id),
ADD COLUMN IF NOT EXISTS payment_mode_id UUID REFERENCES public.payment_modes(id),
ADD COLUMN IF NOT EXISTS price_table_id UUID REFERENCES public.price_tables(id),
ADD COLUMN IF NOT EXISTS freight_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_gross_weight_kg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_address_json JSONB;

-- Add indexes for new foreign keys
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment_terms_id ON public.purchase_orders(payment_terms_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment_mode_id ON public.purchase_orders(payment_mode_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_price_table_id ON public.purchase_orders(price_table_id);
