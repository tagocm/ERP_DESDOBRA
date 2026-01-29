-- Migration: Add Financial Settlements Tables
-- Description: Core tables for financial settlements (clearing, payments, compensations)

CREATE TABLE IF NOT EXISTS financial_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    type TEXT NOT NULL, -- 'PAYMENT', 'RECEIPT', 'COMPENSACAO'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS title_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES financial_settlements(id) ON DELETE CASCADE,
    title_id UUID NOT NULL, 
    title_type TEXT NOT NULL CHECK (title_type IN ('REC', 'PAG')),
    amount NUMERIC(15, 2) NOT NULL,
    interest_amount NUMERIC(15, 2) DEFAULT 0,
    penalty_amount NUMERIC(15, 2) DEFAULT 0,
    discount_amount NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
