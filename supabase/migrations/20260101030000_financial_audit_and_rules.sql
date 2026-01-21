-- Migration: Financial Audit Trail & Strict Transition Rules (Fixed)
-- Description: Creates audit table, logs changes, and enforces strict 'Em Revisão' logic.
-- Fix: Corrected company_members column name (auth_user_id instead of user_id)

BEGIN;

-- 1. Create Audit Table
CREATE TABLE IF NOT EXISTS public.sales_document_finance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id),
    sales_document_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    reason TEXT,
    
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_finance_events_doc_date 
    ON sales_document_finance_events(sales_document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_finance_events_company 
    ON sales_document_finance_events(company_id);

-- Enable RLS
ALTER TABLE public.sales_document_finance_events ENABLE ROW LEVEL SECURITY;

-- Note: Dropping policy if exists to avoid conflict on re-run
DROP POLICY IF EXISTS "Users can view finance events of their company" ON public.sales_document_finance_events;

CREATE POLICY "Users can view finance events of their company"
    ON public.sales_document_finance_events FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    ));

-- 2. Create Audit Trigger Function
CREATE OR REPLACE FUNCTION public.audit_financial_status_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_reason TEXT := 'Alteração manual';
    v_user_id UUID := auth.uid();
BEGIN
    -- Only log if status actually changed
    IF NEW.financial_status IS DISTINCT FROM OLD.financial_status THEN
        
        -- Infer Reason from context
        IF (NEW.status_logistic IS DISTINCT FROM OLD.status_logistic) THEN
            IF NEW.status_logistic::text = 'em_rota' AND NEW.financial_status = 'pre_lancado' THEN
                v_reason := 'Entrou em rota';
            ELSIF NEW.status_logistic::text IN ('nao_entregue', 'pending') AND NEW.financial_status = 'em_revisao' THEN
                IF NEW.status_logistic::text = 'nao_entregue' THEN
                     v_reason := 'Ocorrência logística: não entregue';
                ELSE
                     v_reason := 'Ocorrência logística: devolvido/pendente';
                END IF;
            END IF;
        END IF;

        IF NEW.financial_status = 'aprovado' THEN
             v_reason := 'Aprovado pelo financeiro';
        END IF;

        IF NEW.financial_status = 'cancelado' THEN
             v_reason := 'Pedido Cancelado';
        END IF;

        INSERT INTO public.sales_document_finance_events (
            company_id,
            sales_document_id,
            from_status,
            to_status,
            reason,
            changed_by
        ) VALUES (
            NEW.company_id,
            NEW.id,
            COALESCE(OLD.financial_status, 'unknown'),
            NEW.financial_status,
            v_reason,
            v_user_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Audit Trigger
DROP TRIGGER IF EXISTS on_financial_status_audit ON public.sales_documents;
CREATE TRIGGER on_financial_status_audit
    AFTER UPDATE OF financial_status ON public.sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_financial_status_changes();


-- 3. Update Automation Trigger (Strict Rules)
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
    -- 1. Entering Route: Pendente -> Pre-lancado
    IF NEW.status_logistic::text = 'em_rota' AND (OLD.status_logistic IS DISTINCT FROM 'em_rota') THEN
        
        -- Update Order Status to PRE_LANCADO (Processing)
        IF OLD.financial_status = 'pendente' THEN
             UPDATE sales_documents 
             SET financial_status = 'pre_lancado' 
             WHERE id = NEW.id;
        END IF;

        -- Create AR Title if not exists
        IF NOT EXISTS (SELECT 1 FROM ar_titles WHERE sales_document_id = NEW.id) THEN
            
            -- Fetch Info
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

            -- Create AR Title
            INSERT INTO ar_titles (
                company_id,
                sales_document_id,
                customer_id,
                document_number,
                status, 
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
            RETURNING id INTO v_title_id;

            -- Generate Installments
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

    END IF;

    -- 2. Return Logic: Em Review
    -- Trigger A: Em Rota -> Pendente
    -- Trigger B: Em Rota -> Nao Entregue (Devolvido/Falha)
    -- STRICT RULE: Only if PREVIOUS status was 'aprovado'
    
    IF OLD.status_logistic::text = 'em_rota' AND NEW.status_logistic::text IN ('pending', 'nao_entregue') THEN
        IF OLD.financial_status = 'aprovado' THEN
             UPDATE sales_documents 
             SET financial_status = 'em_revisao'
             WHERE id = NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
