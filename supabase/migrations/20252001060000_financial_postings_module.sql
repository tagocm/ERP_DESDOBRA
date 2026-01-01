-- Migration: Financial Postings Module & Automation
-- Description: Creates financial_postings table and sets up automation for logistic status changes.

-- 1. Create financial_postings table
CREATE TABLE IF NOT EXISTS financial_postings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_document_id uuid NOT NULL REFERENCES sales_documents(id),
    type text NOT NULL DEFAULT 'AR', -- Accounts Receivable ("Contas a Receber")
    status text NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, REJECTED
    amount_total numeric NOT NULL, -- Snapshot of the value at the time of creation
    created_at timestamptz DEFAULT now(),
    approved_at timestamptz,
    approved_by uuid REFERENCES auth.users(id),
    source text NOT NULL DEFAULT 'LOGISTIC_EM_ROTA', -- Logic Source
    notes text,
    
    -- IDEMPOTENCY RULE: Prevent duplicate auto-generated postings for the same order and source logic
    CONSTRAINT financial_postings_idempotency_key UNIQUE (sales_document_id, source)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_postings_status ON financial_postings(status);
CREATE INDEX IF NOT EXISTS idx_financial_postings_doc ON financial_postings(sales_document_id);

-- RLS Policies
ALTER TABLE financial_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view financial postings"
    ON financial_postings FOR SELECT
    USING (true);

CREATE POLICY "Users can update financial postings"
    ON financial_postings FOR UPDATE
    USING (true);

CREATE POLICY "Users can insert financial postings"
    ON financial_postings FOR INSERT
    WITH CHECK (true);


-- 2. Trigger Function
-- Handles logic when sales_documents.status_logistic changes
CREATE OR REPLACE FUNCTION public.handle_sales_order_logistic_change()
RETURNS TRIGGER AS $$
BEGIN
    -- AUTOMATION RULE:
    -- When Logistic Status changes TO 'em_rota' (from anything else)
    IF NEW.status_logistic = 'em_rota' AND (OLD.status_logistic IS DISTINCT FROM 'em_rota') THEN
        
        -- A. Create Financial Posting
        -- We use ON CONFLICT DO NOTHING to ensure idempotency (Case C, E handled).
        -- We take snapshot of total_amount. Assuming total_amount includes freight if applicable.
        INSERT INTO financial_postings (
            sales_document_id,
            amount_total,
            status,
            source,
            type
        )
        VALUES (
            NEW.id,
            COALESCE(NEW.total_amount, 0), -- Robustness against nulls
            'PENDING_APPROVAL',
            'LOGISTIC_EM_ROTA',
            'AR'
        )
        ON CONFLICT ON CONSTRAINT financial_postings_idempotency_key DO NOTHING;

        -- B. Update Financial Status of the Order
        -- Ensure the order is marked as pending financial processing
        NEW.financial_status := 'pending';
        
    END IF;
    
    return NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger Definition
-- Uses BEFORE UPDATE to easily modify NEW.financial_status without recursion or extra queries.
DROP TRIGGER IF EXISTS on_sales_logistic_update ON sales_documents;
CREATE TRIGGER on_sales_logistic_update
    BEFORE UPDATE OF status_logistic ON sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION handle_sales_order_logistic_change();

-- 4. Comments for Documentation
COMMENT ON TABLE financial_postings IS 'Stores pending and approved financial records spawned from orders.';
COMMENT ON TRIGGER on_sales_logistic_update ON sales_documents IS 'Auto-generates financial posting when order enters "em_rota" status.';
