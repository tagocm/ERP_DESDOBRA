-- Add contract total amount as alternative to recurring amount
ALTER TABLE public.recurring_rules
ADD COLUMN IF NOT EXISTS contract_amount NUMERIC(15,2);

-- Update FIXO validation to accept either recurring amount or contract amount
ALTER TABLE public.recurring_rules
DROP CONSTRAINT IF EXISTS check_fixo_amount;

ALTER TABLE public.recurring_rules
ADD CONSTRAINT check_fixo_amount
CHECK (
  amount_type <> 'FIXO'
  OR (
    COALESCE(fixed_amount, 0) > 0
    OR COALESCE(contract_amount, 0) > 0
  )
);
