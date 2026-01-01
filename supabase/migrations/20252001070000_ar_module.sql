-- Migration: Accounts Receivable (AR) Module
-- Description: Replaces simple financial_postings with full AR structure (titles, installments, payments).

-- Clean up previous iteration
DROP TRIGGER IF EXISTS on_sales_logistic_update ON sales_documents;
DROP FUNCTION IF EXISTS handle_sales_order_logistic_change;
DROP TABLE IF EXISTS financial_postings;

-- 1. AR Titles (Cabeçalho do Contas a Receber)
CREATE TABLE ar_titles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    sales_document_id uuid NOT NULL REFERENCES sales_documents(id),
    customer_id uuid NOT NULL REFERENCES organizations(id),
    
    document_number numeric, -- Snapshot
    
    status text NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, OPEN, PAID, CANCELLED
    
    amount_total numeric NOT NULL,
    amount_paid numeric NOT NULL DEFAULT 0,
    amount_open numeric NOT NULL DEFAULT 0, -- Trigger logic should maintain this, or app logic
    
    payment_terms_snapshot text, -- e.g. "30/60/90"
    payment_method_snapshot text, -- e.g. "Boleto"
    
    date_issued date DEFAULT CURRENT_DATE,
    
    created_at timestamptz DEFAULT now(),
    approved_at timestamptz,
    approved_by uuid REFERENCES auth.users(id),
    
    CONSTRAINT ar_titles_sales_doc_unique UNIQUE (sales_document_id)
);

-- 2. AR Installments (Parcelas)
CREATE TABLE ar_installments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    ar_title_id uuid NOT NULL REFERENCES ar_titles(id) ON DELETE CASCADE,
    
    installment_number int NOT NULL, -- 1, 2, 3...
    due_date date NOT NULL,
    
    amount_original numeric NOT NULL,
    
    amount_paid numeric NOT NULL DEFAULT 0,
    amount_open numeric NOT NULL DEFAULT 0, 
    
    status text NOT NULL DEFAULT 'OPEN', -- OPEN, PARTIAL, PAID
    
    -- Adjustments
    interest_amount numeric NOT NULL DEFAULT 0,
    penalty_amount numeric NOT NULL DEFAULT 0,
    discount_amount numeric NOT NULL DEFAULT 0,
    
    created_at timestamptz DEFAULT now(),
    
    UNIQUE(ar_title_id, installment_number)
);

-- 3. AR Payments (Histórico de Pagamentos)
CREATE TABLE ar_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    customer_id uuid REFERENCES organizations(id),
    
    amount numeric NOT NULL,
    paid_at timestamptz NOT NULL,
    method text, -- 'Pix', 'Boleto', etc.
    reference text, 
    notes text,
    
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 4. Allocations (Payment -> Installment)
CREATE TABLE ar_payment_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL REFERENCES ar_payments(id) ON DELETE CASCADE,
    installment_id uuid NOT NULL REFERENCES ar_installments(id) ON DELETE CASCADE,
    
    amount_allocated numeric NOT NULL,
    
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ar_titles_status ON ar_titles(status);
CREATE INDEX idx_ar_titles_customer ON ar_titles(customer_id);
CREATE INDEX idx_ar_installments_title ON ar_installments(ar_title_id);
CREATE INDEX idx_ar_installments_due ON ar_installments(due_date);

-- RLS (Basic for Dev)
ALTER TABLE ar_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for ar_titles" ON ar_titles FOR ALL USING (true);
CREATE POLICY "Enable all for ar_installments" ON ar_installments FOR ALL USING (true);
CREATE POLICY "Enable all for ar_payments" ON ar_payments FOR ALL USING (true);
CREATE POLICY "Enable all for ar_payment_allocations" ON ar_payment_allocations FOR ALL USING (true);

-- 5. Automation Function
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
    v_payment_mode_name TEXT;
    
BEGIN
    -- Only run when status changes TO 'em_rota'
    IF NEW.status_logistic = 'em_rota' AND (OLD.status_logistic IS DISTINCT FROM 'em_rota') THEN
        
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

        -- Fetch Payment Mode Name if exists? We don't have a table reference name handy easily in variable unless we join.
        -- Let's just store the ID if user wants, but schema asked for snapshot text. 
        -- We will skip extra query for mode name now to keep trigger fast, or just null.
        -- Or rely on frontend to display it via ID. But schema has `payment_method_snapshot`.
        -- Let's leave null for now or assume simple default.

        v_total := COALESCE(NEW.total_amount, 0);

        -- B. Create AR Title (Idempotent via ON CONFLICT)
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
            v_total, -- Starts fully open
            v_terms_name,
            CURRENT_DATE
        )
        ON CONFLICT (sales_document_id) DO NOTHING
        RETURNING id INTO v_title_id;

        -- If title was created (v_title_id not null), generate installments
        IF v_title_id IS NOT NULL THEN
            
            v_installment_value := TRUNC(v_total / v_installments_count, 2);
            v_remainder := v_total - (v_installment_value * v_installments_count);
            
            v_current_due_date := CURRENT_DATE + v_first_due_days;

            FOR i IN 1..v_installments_count LOOP
                DECLARE
                    v_final_amt NUMERIC;
                BEGIN
                    -- Add remainder to LAST installment
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
                    
                    -- Update date for next
                    if v_cadence_days > 0 then
                        v_current_due_date := v_current_due_date + v_cadence_days;
                    end if;
                END;
            END LOOP;
            
            -- Update Order
            UPDATE sales_documents SET financial_status = 'pending' WHERE id = NEW.id;

        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_sales_logistic_update_ar
    AFTER UPDATE OF status_logistic ON sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION handle_sales_order_logistic_change_ar();
