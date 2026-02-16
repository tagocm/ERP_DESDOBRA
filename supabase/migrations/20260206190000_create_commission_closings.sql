-- ============================================================================
-- COMMISSION CLOSINGS TABLE
-- Stores commission closing periods (draft, closed, reopened)
-- ============================================================================

CREATE TABLE IF NOT EXISTS commission_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Período
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Status: draft, closed, reopened
    status TEXT NOT NULL DEFAULT 'draft',
    
    -- Metadados
    commission_rate NUMERIC(5,2), -- Taxa padrão se não houver no rep
    notes TEXT,
    
    -- Auditoria
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    reopened_at TIMESTAMPTZ,
    reopened_by UUID REFERENCES users(id),
    reopen_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT valid_period CHECK (period_end > period_start),
    CONSTRAINT valid_status CHECK (status IN ('draft', 'closed', 'reopened')),
    UNIQUE(company_id, period_start, period_end)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_commission_closings_company ON commission_closings(company_id);
CREATE INDEX IF NOT EXISTS idx_commission_closings_period ON commission_closings(company_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_commission_closings_status ON commission_closings(status);

-- RLS (Row Level Security)
ALTER TABLE commission_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_closings_select ON commission_closings;
CREATE POLICY commission_closings_select ON commission_closings
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid())
    );

DROP POLICY IF EXISTS commission_closings_insert ON commission_closings;
CREATE POLICY commission_closings_insert ON commission_closings
    FOR INSERT WITH CHECK (
        company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid())
    );

DROP POLICY IF EXISTS commission_closings_update ON commission_closings;
CREATE POLICY commission_closings_update ON commission_closings
    FOR UPDATE USING (
        company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid())
    );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_commission_closings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_commission_closings_updated_at ON commission_closings;
CREATE TRIGGER trigger_commission_closings_updated_at
    BEFORE UPDATE ON commission_closings
    FOR EACH ROW
    EXECUTE FUNCTION update_commission_closings_updated_at();
