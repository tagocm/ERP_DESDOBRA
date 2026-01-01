ALTER TABLE public.ar_installments 
ADD COLUMN IF NOT EXISTS payment_method TEXT;
