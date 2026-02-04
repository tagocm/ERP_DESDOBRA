-- Migration: Refactor recurring_rules table
-- Purpose: Separate validity (vigência) from billing plan and support manual/automatic modes.

ALTER TABLE public.recurring_rules
ADD COLUMN IF NOT EXISTS valid_from DATE,
ADD COLUMN IF NOT EXISTS valid_to DATE,
ADD COLUMN IF NOT EXISTS generation_mode TEXT DEFAULT 'AUTOMATICO' CHECK (generation_mode IN ('AUTOMATICO', 'MANUAL')),
ADD COLUMN IF NOT EXISTS billing_plan_type TEXT CHECK (billing_plan_type IN ('RECORRENTE', 'PARCELADO')),
ADD COLUMN IF NOT EXISTS first_due_date DATE,
ADD COLUMN IF NOT EXISTS installments_count INTEGER,
ADD COLUMN IF NOT EXISTS amount_type TEXT DEFAULT 'FIXO' CHECK (amount_type IN ('FIXO', 'VARIAVEL')),
ADD COLUMN IF NOT EXISTS fixed_amount NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS estimated_amount NUMERIC(15,2);

-- Migrate existing data
UPDATE public.recurring_rules 
SET 
    valid_from = (start_month || '-01')::DATE,
    valid_to = CASE WHEN end_month IS NOT NULL THEN (end_month || '-01')::DATE ELSE NULL END,
    generation_mode = CASE WHEN auto_generate THEN 'AUTOMATICO' ELSE 'MANUAL' END,
    billing_plan_type = 'RECORRENTE',
    first_due_date = (start_month || '-' || LPAD(due_day::text, 2, '0'))::DATE,
    amount_type = rule_type,
    fixed_amount = amount
WHERE valid_from IS NULL;

-- Add constraints after migration
ALTER TABLE public.recurring_rules
ALTER COLUMN valid_from SET NOT NULL,
ADD CONSTRAINT check_valid_dates CHECK (valid_to IS NULL OR valid_to >= valid_from),
ADD CONSTRAINT check_manual_mode CHECK (
    generation_mode <> 'MANUAL' OR (
        first_due_date IS NULL AND 
        billing_plan_type IS NULL AND 
        installments_count IS NULL
    )
),
ADD CONSTRAINT check_automatic_mode CHECK (
    generation_mode <> 'AUTOMATICO' OR (
        first_due_date IS NOT NULL AND 
        billing_plan_type IS NOT NULL
    )
),
ADD CONSTRAINT check_parcelado_mode CHECK (
    billing_plan_type <> 'PARCELADO' OR (
        installments_count IS NOT NULL AND 
        installments_count > 0
    )
),
ADD CONSTRAINT check_fixo_amount CHECK (
    amount_type <> 'FIXO' OR (
        fixed_amount IS NOT NULL AND 
        fixed_amount > 0
    )
);

-- Clean up old columns (optional but recommended once logic is updated)
-- ALTER TABLE public.recurring_rules DROP COLUMN IF EXISTS start_month;
-- ALTER TABLE public.recurring_rules DROP COLUMN IF EXISTS end_month;
-- ALTER TABLE public.recurring_rules DROP COLUMN IF EXISTS due_day;
-- ALTER TABLE public.recurring_rules DROP COLUMN IF EXISTS auto_generate;
-- ALTER TABLE public.recurring_rules DROP COLUMN IF EXISTS rule_type;
-- ALTER TABLE public.recurring_rules DROP COLUMN IF EXISTS amount;
-- ALTER TABLE public.recurring_rules DROP COLUMN IF EXISTS category; -- Now using category_id
