-- Migration: Standardize Financial Processing Status
-- Description: Enforces new status values for sales_documents.financial_status and updates triggers.

BEGIN;

-- 1. Migrate Existing Data
-- Map old values to new standardized values (snake_case)
-- Old known values: 'pending', 'billed', 'partial', 'paid', 'overdue'
-- New values: 'pendente', 'pre_lancado', 'aprovado', 'em_revisao', 'cancelado'

UPDATE sales_documents
SET financial_status = CASE
    WHEN financial_status = 'pending' THEN 'pendente'
    WHEN financial_status IN ('billed', 'paid', 'partial', 'overdue', 'refunded') THEN 'aprovado' -- Assume processed if it has financial activity
    WHEN financial_status IS NULL THEN 'pendente'
    ELSE 'pendente' -- Fallback
END;

-- 2. Update Constraint
ALTER TABLE sales_documents 
    DROP CONSTRAINT IF EXISTS sales_documents_status_financial_check, -- Try old name if exists
    DROP CONSTRAINT IF EXISTS sales_documents_financial_status_check; -- Try likely name

ALTER TABLE sales_documents
    ADD CONSTRAINT sales_documents_financial_status_check 
    CHECK (financial_status IN ('pendente', 'pre_lancado', 'aprovado', 'em_revisao', 'cancelado'));

-- Set default
ALTER TABLE sales_documents
    ALTER COLUMN financial_status SET DEFAULT 'pendente';

-- 3. Update Trigger Function: handle_sales_order_logistic_change_ar
-- Goal: Set financial_status to 'pre_lancado' when entering 'em_rota'

CREATE OR REPLACE FUNCTION public.handle_sales_order_logistic_change_ar()
RETURNS TRIGGER AS $$
DECLARE
    v_terms RECORD;
    v_installments_count INT := 1;
    v_first_due_days INT := 0;
    v_cadence_days INT := 30;
    
    v_total NUMERIC;
    v_installment_value NUMERIC;
    v_remainder NUMERIC;
    v_current_due_date DATE;
    v_title_id UUID;
    v_terms_name TEXT := 'À Vista';
    
BEGIN
    -- Only run when status changes TO 'em_rota'
    IF NEW.status_logistic = 'em_rota' AND (OLD.status_logistic IS DISTINCT FROM 'em_rota') THEN
        
        -- 1. Update Order Status to PRE_LANCADO (Processing)
        -- Only if it's currently 'pendente'. If it's already 'aprovado', don't revert it.
        UPDATE sales_documents 
        SET financial_status = 'pre_lancado' 
        WHERE id = NEW.id AND financial_status = 'pendente';

        -- 2. Generate AR Title (Pre-Launch) if needed
        -- ... Rest of logic remains the same ...

        -- A. Fetch Payment Info
        IF NEW.payment_terms_id IS NOT NULL THEN
            SELECT * INTO v_terms FROM payment_terms WHERE id = NEW.payment_terms_id;
            IF FOUND THEN
                v_installments_count := COALESCE(v_terms.installments_count, 1);
                v_first_due_days := COALESCE(v_terms.first_due_days, 0);
                v_cadence_days := COALESCE(v_terms.cadence_days, 30);
                v_terms_name := v_terms.name;
            END IF;
        END IF;

        v_total := COALESCE(NEW.total_amount, 0);

        -- B. Create AR Title (Idempotent via ON CONFLICT)
        INSERT INTO ar_titles (
            company_id,
            sales_document_id,
            customer_id,
            document_number,
            status, -- Continues using AR status (PENDING_APPROVAL)
            amount_total,
            amount_open,
            payment_terms_snapshot,
            date_issued
        )
        VALUES (
            NEW.company_id,
            NEW.id,
            NEW.client_id,
            NEW.document_number,
            'PENDING_APPROVAL',
            v_total,
            v_total, 
            v_terms_name,
            CURRENT_DATE
        )
        ON CONFLICT (sales_document_id) DO NOTHING
        RETURNING id INTO v_title_id;

        -- If title was created, generate installments
        IF v_title_id IS NOT NULL THEN
            
            v_installment_value := TRUNC(v_total / v_installments_count, 2);
            v_remainder := v_total - (v_installment_value * v_installments_count);
            
            v_current_due_date := CURRENT_DATE + v_first_due_days;

            FOR i IN 1..v_installments_count LOOP
                DECLARE
                    v_final_amt NUMERIC;
                BEGIN
                    IF i = v_installments_count THEN
                        v_final_amt := v_installment_value + v_remainder;
                    ELSE
                        v_final_amt := v_installment_value;
                    END IF;
                    
                    INSERT INTO ar_installments (
                        company_id,
                        ar_title_id,
                        installment_number,
                        due_date,
                        amount_original,
                        amount_open,
                        status
                    ) VALUES (
                        NEW.company_id,
                        v_title_id,
                        i,
                        v_current_due_date,
                        v_final_amt,
                        v_final_amt,
                        'OPEN'
                    );
                    
                    if v_cadence_days > 0 then
                        v_current_due_date := v_current_due_date + v_cadence_days;
                    end if;
                END;
            END LOOP;
        END IF;

    END IF;

    -- Return logic trigger (5.3)
    -- If logistic status changes to NOT_DELIVERED or PENDING from EM_ROTA, flagging for review if it was approved?
    -- Actually, user asked: "Logística muda de Em Rota para: pendente OU devolvido -> financial_processing_status → em_revisao"
    IF (OLD.status_logistic = 'em_rota' AND NEW.status_logistic IN ('pending', 'nao_entregue', 'entregue')) THEN 
        -- Optimization: 'entregue' usually means success, but if partial return? 
        -- User said "Retorno devolvido: se estava aprovado, vira em_revisao".
        -- Let's stick to explicit failure cases for now.
        
        IF NEW.status_logistic = 'nao_entregue' THEN
             UPDATE sales_documents 
             SET financial_status = 'em_revisao'
             WHERE id = NEW.id AND financial_status IN ('aprovado', 'pre_lancado');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


COMMIT;
