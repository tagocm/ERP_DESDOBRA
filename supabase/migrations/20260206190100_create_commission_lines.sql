-- ============================================================================
-- COMMISSION LINES TABLE
-- Stores individual commission calculations per payment (RECEIPT_V1 rule)
-- ============================================================================

CREATE TABLE commission_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closing_id UUID NOT NULL REFERENCES commission_closings(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Representante
    sales_rep_id UUID NOT NULL REFERENCES users(id),
    sales_rep_name TEXT NOT NULL, -- Snapshot
    
    -- Venda
    sales_document_id UUID NOT NULL REFERENCES sales_documents(id),
    document_number INTEGER,
    customer_id UUID REFERENCES organizations(id),
    customer_name TEXT,
    
    -- Financeiro (fonte da comissão - RECEIPT_V1)
    ar_payment_id UUID NOT NULL REFERENCES ar_payments(id),
    payment_date TIMESTAMPTZ NOT NULL, -- Snapshot de paid_at
    
    -- Cálculo
    payment_amount NUMERIC(15,2) NOT NULL, -- Base (valor recebido)
    commission_rate NUMERIC(5,2) NOT NULL, -- Percentual
    commission_amount NUMERIC(15,2) NOT NULL, -- Resultado
    
    -- Flags
    is_reversal BOOLEAN DEFAULT false, -- Se é estorno/devolução
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT valid_commission_rate CHECK (commission_rate >= 0 AND commission_rate <= 100)
);

-- Índices para performance
CREATE INDEX idx_commission_lines_closing ON commission_lines(closing_id);
CREATE INDEX idx_commission_lines_rep ON commission_lines(sales_rep_id);
CREATE INDEX idx_commission_lines_payment ON commission_lines(ar_payment_id);
CREATE INDEX idx_commission_lines_document ON commission_lines(sales_document_id);

-- Índice único para idempotência (mesma fonte não duplica)
CREATE UNIQUE INDEX idx_commission_lines_unique_payment ON commission_lines(closing_id, ar_payment_id);

-- RLS (Row Level Security)
ALTER TABLE commission_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY commission_lines_select ON commission_lines
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid())
    );

CREATE POLICY commission_lines_insert ON commission_lines
    FOR INSERT WITH CHECK (
        company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid())
    );

-- Comentários para documentação
COMMENT ON TABLE commission_lines IS 'Commission calculations based on RECEIPT_V1 rule (trigger = payment received)';
COMMENT ON COLUMN commission_lines.ar_payment_id IS 'Payment that triggered this commission (RECEIPT_V1)';
COMMENT ON COLUMN commission_lines.payment_amount IS 'Base amount for commission calculation (amount received)';
COMMENT ON COLUMN commission_lines.is_reversal IS 'True if this is a negative commission from payment reversal';
