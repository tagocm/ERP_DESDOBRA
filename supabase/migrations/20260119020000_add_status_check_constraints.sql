-- Migration: Add CHECK Constraints for Status Fields
-- Created: 2026-01-19
-- Purpose: Add protective CHECK constraints since data is already in PT-BR

BEGIN;

-- ========================================
-- Add CHECK constraints to sales_documents
-- ========================================

-- status_logistic (data already clean, just add protection)
ALTER TABLE public.sales_documents 
DROP CONSTRAINT IF EXISTS sales_documents_status_logistic_check;

ALTER TABLE public.sales_documents 
ADD CONSTRAINT sales_documents_status_logistic_check
CHECK (status_logistic IN (
    'pending', 'roteirizado', 'agendado', 'em_rota', 
    'entregue', 'devolvido', 'parcial'
));

-- status_fiscal (data already clean, just add protection)
ALTER TABLE public.sales_documents 
DROP CONSTRAINT IF EXISTS sales_documents_status_fiscal_check;

ALTER TABLE public.sales_documents 
ADD CONSTRAINT sales_documents_status_fiscal_check
CHECK (status_fiscal IN (
    'none', 'authorized', 'cancelled', 'error'
));

-- financial_status (data already clean, just add protection)
ALTER TABLE public.sales_documents 
DROP CONSTRAINT IF EXISTS sales_documents_financial_status_check;

ALTER TABLE public.sales_documents 
ADD CONSTRAINT sales_documents_financial_status_check
CHECK (financial_status IS NULL OR financial_status IN (
    'pending', 'pre_lancado', 'approved', 'em_revisao', 'cancelado'
));

-- ========================================
-- Create indexes for performance
-- ========================================

CREATE INDEX IF NOT EXISTS idx_sales_documents_status_logistic 
ON public.sales_documents(status_logistic);

CREATE INDEX IF NOT EXISTS idx_sales_documents_financial_status 
ON public.sales_documents(financial_status) 
WHERE financial_status IS NOT NULL;

-- ========================================
-- Validation
-- ========================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Verify all existing data passes the new constraints
    SELECT COUNT(*) INTO v_count
    FROM public.sales_documents
    WHERE status_logistic NOT IN (
        'pending', 'roteirizado', 'agendado', 'em_rota', 
        'entregue', 'devolvido', 'parcial'
    );
    
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Found % records with invalid status_logistic values', v_count;
    END IF;
    
    SELECT COUNT(*) INTO v_count
    FROM public.sales_documents
    WHERE financial_status IS NOT NULL
    AND financial_status NOT IN (
        'pending', 'pre_lancado', 'approved', 'em_revisao', 'cancelado'
    );
    
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Found % records with invalid financial_status values', v_count;
    END IF;
    
    RAISE NOTICE '✅ All data passes new CHECK constraints';
    RAISE NOTICE '✅ Migration complete - status fields are now protected';
END $$;

COMMIT;
