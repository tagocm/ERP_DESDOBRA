-- ========================================================================
-- Vehicle Documents & Financial Integration
-- ========================================================================
-- Purpose: Manage IPVA, Licensing, Insurance and auto-generate Payables
-- Tables: vehicle_documents, financial_entries
-- ========================================================================

-- 1. VEHICLE DOCUMENTS
CREATE TABLE IF NOT EXISTS vehicle_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    
    -- Core fields
    type TEXT NOT NULL CHECK (type IN ('IPVA', 'LICENCIAMENTO', 'SEGURO')),
    competency_year INTEGER NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    due_date DATE NOT NULL,
    paid_at DATE,
    
    -- Status (Computed/Persisted)
    status TEXT NOT NULL CHECK (status IN ('PAGO', 'VENCIDO', 'EM_ABERTO')),
    
    -- Insurance specific
    insurer TEXT,
    policy_number TEXT,
    coverage_start DATE,
    coverage_end DATE,
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_company ON vehicle_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle ON vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_due_date ON vehicle_documents(due_date);

-- Trigger for updated_at
CREATE TRIGGER update_vehicle_documents_updated_at
    BEFORE UPDATE ON vehicle_documents
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- RLS
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_documents_multi_tenant"
ON vehicle_documents
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid())
);


-- 2. FINANCIAL ENTRIES (Simplified Payables)
-- Purpose: Store pending approval payables without coupling to full financial events system yet
CREATE TABLE IF NOT EXISTS financial_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Origin
    origin_type TEXT NOT NULL, -- e.g. 'VEHICLE_DOCUMENT'
    origin_id UUID NOT NULL,   -- e.g. vehicle_documents.id
    
    -- Nature
    kind TEXT NOT NULL DEFAULT 'PAYABLE' CHECK (kind IN ('PAYABLE', 'RECEIVABLE')),
    
    -- Details
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    due_date DATE NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'PENDENTE_DE_APROVACAO' CHECK (status IN ('PENDENTE_DE_APROVACAO', 'APROVADO', 'REJEITADO', 'CANCELADO')),
    
    -- Approval info
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: 1 financial entry per origin document
    CONSTRAINT financial_entries_origin_unique UNIQUE (company_id, origin_type, origin_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_entries_company ON financial_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_status ON financial_entries(status);
CREATE INDEX IF NOT EXISTS idx_financial_entries_origin ON financial_entries(origin_type, origin_id);

-- Trigger for updated_at
CREATE TRIGGER update_financial_entries_updated_at
    BEFORE UPDATE ON financial_entries
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- RLS
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_entries_multi_tenant"
ON financial_entries
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid())
);


-- 3. SYNC TRIGGER (Vehicle Documents -> Financial Entries)
CREATE OR REPLACE FUNCTION trg_sync_vehicle_document_finance()
RETURNS TRIGGER AS $$
DECLARE
    v_vehicle_name TEXT;
    v_description TEXT;
BEGIN
    -- Get vehicle name for description
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT COALESCE(model || ' - ' || plate, 'Veículo desconhecido') INTO v_vehicle_name
        FROM vehicles
        WHERE id = NEW.vehicle_id;
        
        v_description := NEW.type || ' - ' || v_vehicle_name || ' - ' || NEW.competency_year;
    END IF;

    -- INSERT
    IF TG_OP = 'INSERT' THEN
        INSERT INTO financial_entries (
            company_id,
            origin_type,
            origin_id,
            kind,
            description,
            amount,
            due_date,
            status
        ) VALUES (
            NEW.company_id,
            'VEHICLE_DOCUMENT',
            NEW.id,
            'PAYABLE',
            v_description,
            NEW.amount,
            NEW.due_date,
            'PENDENTE_DE_APROVACAO'
        );
        RETURN NEW;

    -- UPDATE
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only update if relevant fields changed
        IF NEW.amount <> OLD.amount OR NEW.due_date <> OLD.due_date OR NEW.type <> OLD.type OR NEW.competency_year <> OLD.competency_year THEN
            UPDATE financial_entries
            SET 
                description = v_description,
                amount = NEW.amount,
                due_date = NEW.due_date,
                updated_at = NOW()
            WHERE origin_type = 'VEHICLE_DOCUMENT' 
              AND origin_id = NEW.id
              AND status = 'PENDENTE_DE_APROVACAO'; -- Only update if still pending
        END IF;
        RETURN NEW;

    -- DELETE
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM financial_entries
        WHERE origin_type = 'VEHICLE_DOCUMENT' 
          AND origin_id = OLD.id
          AND status = 'PENDENTE_DE_APROVACAO'; -- Only delete if still pending (haven't been approved/processed yet)
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach Trigger
DROP TRIGGER IF EXISTS on_vehicle_document_change ON vehicle_documents;
CREATE TRIGGER on_vehicle_document_change
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_documents
    FOR EACH ROW
    EXECUTE PROCEDURE trg_sync_vehicle_document_finance();
