
-- Migration: Update Payment Terms Schema
-- Date: 2025-12-24 10:00:00

-- Add new columns for payment rules
ALTER TABLE public.payment_terms
    ADD COLUMN IF NOT EXISTS installments_count INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS first_due_days INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cadence_days INTEGER, -- Null if N=1
    ADD COLUMN IF NOT EXISTS is_custom_name BOOLEAN NOT NULL DEFAULT false;

-- Constraints
ALTER TABLE public.payment_terms
    ADD CONSTRAINT check_installments_count CHECK (installments_count >= 1 AND installments_count <= 48),
    ADD CONSTRAINT check_first_due_days CHECK (first_due_days >= 0),
    ADD CONSTRAINT check_cadence_days CHECK (
        (installments_count = 1 AND cadence_days IS NULL) OR
        (installments_count > 1 AND cadence_days IS NOT NULL AND cadence_days >= 0)
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_terms_active_company ON public.payment_terms(company_id, is_active);
