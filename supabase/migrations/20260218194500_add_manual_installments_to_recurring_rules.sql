-- Add support for manual installment scheduling in recurring rules
ALTER TABLE public.recurring_rules
ADD COLUMN IF NOT EXISTS manual_installments JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.recurring_rules
DROP CONSTRAINT IF EXISTS check_manual_installments_is_array;

ALTER TABLE public.recurring_rules
ADD CONSTRAINT check_manual_installments_is_array
CHECK (jsonb_typeof(manual_installments) = 'array');
