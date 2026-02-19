-- ========================================================================
-- Refine Vehicle Documents & Financial Integration
-- ========================================================================
-- Purpose: Match "Multas" UI pattern, support installments, prevent deletions if approved.
-- ========================================================================

-- 1. Recreate table (Drop first to Ensure Clean Slate for new Schema)
DROP TRIGGER IF EXISTS on_vehicle_document_change ON vehicle_documents;
DROP FUNCTION IF EXISTS trg_sync_vehicle_document_finance();
DROP TABLE IF EXISTS vehicle_documents;

CREATE TABLE vehicle_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
    
    -- Core fields
    type TEXT NOT NULL CHECK (type IN ('IPVA', 'LICENCIAMENTO')),
    competency_year INTEGER NOT NULL CHECK (competency_year >= 2000),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    
    -- Installments
    installments_count INTEGER NOT NULL DEFAULT 1 CHECK (installments_count BETWEEN 1 AND 12),
    first_due_date DATE NOT NULL,
    
    -- Status (Simple/Calculated)
    status TEXT NOT NULL DEFAULT 'EM_ABERTO' CHECK (status IN ('EM_ABERTO', 'VENCIDO')),
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint for logic integrity
    CONSTRAINT vehicle_documents_origin_unique UNIQUE (company_id, vehicle_id, type, competency_year, first_due_date)
);

-- Indexes
CREATE INDEX idx_vehicle_documents_company_vehicle ON vehicle_documents(company_id, vehicle_id);
CREATE INDEX idx_vehicle_documents_company_type ON vehicle_documents(company_id, type);
CREATE INDEX idx_vehicle_documents_company_date ON vehicle_documents(company_id, first_due_date);

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


-- 2. SYNC TRIGGER (Vehicle Documents -> Financial Entries)
CREATE OR REPLACE FUNCTION trg_sync_vehicle_document_finance()
RETURNS TRIGGER AS $$
DECLARE
    v_vehicle_name TEXT;
    v_base_description TEXT;
    v_installment_amount NUMERIC(15, 2);
    v_last_installment_amount NUMERIC(15, 2);
    v_current_due_date DATE;
    v_count_approved INTEGER;
BEGIN
    -- Get vehicle name for description
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT COALESCE(model || ' - ' || plate, 'Veículo desconhecido') INTO v_vehicle_name
        FROM fleet_vehicles
        WHERE id = NEW.vehicle_id;
        
        v_base_description := NEW.type || ' - ' || v_vehicle_name || ' - ' || NEW.competency_year;
    END IF;

    -- DELETE
    IF TG_OP = 'DELETE' THEN
        -- Check if any linked financial entry is NOT pending
        SELECT COUNT(*) INTO v_count_approved
        FROM financial_entries
        WHERE origin_type = 'VEHICLE_DOCUMENT'
          AND origin_id = OLD.id
          AND status <> 'PENDENTE_DE_APROVACAO';

        IF v_count_approved > 0 THEN
            RAISE EXCEPTION 'Não é possível excluir este documento pois existem lançamentos financeiros já aprovados ou pagos vinculados a ele.';
        END IF;

        -- Delete all linked pending entries
        DELETE FROM financial_entries
        WHERE origin_type = 'VEHICLE_DOCUMENT' 
          AND origin_id = OLD.id
          AND status = 'PENDENTE_DE_APROVACAO';
          
        RETURN OLD;
    END IF;

    -- UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Check if critical fields changed
        IF NEW.amount <> OLD.amount OR NEW.installments_count <> OLD.installments_count OR NEW.first_due_date <> OLD.first_due_date THEN
            
            -- Check if any linked financial entry is NOT pending
            SELECT COUNT(*) INTO v_count_approved
            FROM financial_entries
            WHERE origin_type = 'VEHICLE_DOCUMENT'
              AND origin_id = NEW.id
              AND status <> 'PENDENTE_DE_APROVACAO';

            IF v_count_approved > 0 THEN
                RAISE EXCEPTION 'Não é possível alterar valores ou parcelas deste documento pois existem lançamentos financeiros já aprovados ou pagos vinculados a ele.';
            END IF;

            -- Delete old pending entries and recreate (simplest strategy for full regenerate)
            DELETE FROM financial_entries
            WHERE origin_type = 'VEHICLE_DOCUMENT' 
              AND origin_id = NEW.id
              AND status = 'PENDENTE_DE_APROVACAO';
              
            -- Fallthrough to INSERT logic to recreate
        ELSE
            -- Non-critical update (notes, etc) - simple update
            -- Update existing entries descriptions if needed, but keeping simple for now
            RETURN NEW;
        END IF;
    END IF;

    -- INSERT (or Re-Insert from Update flow where we recreate entries)
    -- Logic: Create N installments
    
    -- Calculate generic installment amount (floor)
    v_installment_amount := TRUNC(NEW.amount / NEW.installments_count, 2);
    
    -- Calculate last installment (remainder)
    v_last_installment_amount := NEW.amount - (v_installment_amount * (NEW.installments_count - 1));
    
    v_current_due_date := NEW.first_due_date;

    FOR i IN 1..NEW.installments_count LOOP
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
            v_base_description || ' (Parcela ' || i || '/' || NEW.installments_count || ')',
            CASE WHEN i = NEW.installments_count THEN v_last_installment_amount ELSE v_installment_amount END,
            v_current_due_date,
            'PENDENTE_DE_APROVACAO'
        );
        
        -- Increment month for next installment
        v_current_due_date := v_current_due_date + INTERVAL '1 month';
    END LOOP;
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach Trigger
CREATE TRIGGER on_vehicle_document_change
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_documents
    FOR EACH ROW
    EXECUTE PROCEDURE trg_sync_vehicle_document_finance();
