-- Adiciona vínculo de forma de pagamento ao fato gerador (idempotente e retrocompatível)

ALTER TABLE public.recurring_rules
  ADD COLUMN IF NOT EXISTS payment_mode_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recurring_rules_payment_mode_id_fkey'
  ) THEN
    ALTER TABLE public.recurring_rules
      ADD CONSTRAINT recurring_rules_payment_mode_id_fkey
      FOREIGN KEY (payment_mode_id)
      REFERENCES public.payment_modes(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_recurring_rules_payment_mode_id
  ON public.recurring_rules(payment_mode_id);
