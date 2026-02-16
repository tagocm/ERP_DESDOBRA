-- Sprint 4: Expansion of Status ENUMs Type Safety
-- Objective: Transition status_logistic and financial_status to ENUMs

BEGIN;

-- 1. Create Logistic Status ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_logistic_status') THEN
        CREATE TYPE public.sales_logistic_status AS ENUM (
            'pending', 'roteirizado', 'agendado', 'expedition', 'em_rota', 'entregue', 'nao_entregue', 'devolvido', 'parcial', 'cancelado'
        );
    END IF;
END $$;

-- 2. Create Financial Status ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_status_enum') THEN
        CREATE TYPE public.financial_status_enum AS ENUM (
            'pending', 'pre_lancado', 'approved', 'em_revisao', 'cancelado', 'pago', 'atrasado', 'parcial'
        );
    END IF;
END $$;

-- 3. Add temporary columns to sales_documents
ALTER TABLE public.sales_documents
ADD COLUMN IF NOT EXISTS status_logistic_new public.sales_logistic_status,
ADD COLUMN IF NOT EXISTS financial_status_new public.financial_status_enum;

-- 4. Backfill Logistic Status
UPDATE public.sales_documents
SET status_logistic_new = 
  CASE status_logistic::text
    WHEN 'pending' THEN 'pending'::public.sales_logistic_status
    WHEN 'separation' THEN 'roteirizado'::public.sales_logistic_status  -- EN separation maps to PT roteirizado (organized/scheduled)
    WHEN 'expedition' THEN 'expedition'::public.sales_logistic_status
    WHEN 'delivered' THEN 'entregue'::public.sales_logistic_status
    ELSE status_logistic::text::public.sales_logistic_status  -- Direct cast for PT values
  END
WHERE status_logistic IS NOT NULL 
  AND status_logistic::text IN ('pending', 'roteirizado', 'agendado', 'separation', 'expedition', 'em_rota', 'entregue', 'delivered', 'nao_entregue', 'devolvido', 'parcial', 'cancelado');

-- 5. Backfill Financial Status
UPDATE public.sales_documents
SET financial_status_new = 
  CASE financial_status::text
    WHEN 'pending' THEN 'pending'::public.financial_status_enum
    ELSE financial_status::text::public.financial_status_enum  -- Direct cast for PT values
  END
WHERE financial_status IS NOT NULL 
  AND financial_status::text IN ('pending', 'pre_lancado', 'approved', 'em_revisao', 'cancelado', 'pago', 'atrasado', 'parcial');

-- 6. Set Defaults/Fallback for mismatches
UPDATE public.sales_documents
SET status_logistic_new = 'pending'
WHERE status_logistic_new IS NULL AND status_logistic IS NOT NULL;

UPDATE public.sales_documents
SET financial_status_new = 'pending'
WHERE financial_status_new IS NULL AND financial_status IS NOT NULL;

-- 7. Add NOT NULL constraints
ALTER TABLE public.sales_documents
ALTER COLUMN status_logistic_new SET NOT NULL,
ALTER COLUMN financial_status_new SET NOT NULL;

COMMIT;
