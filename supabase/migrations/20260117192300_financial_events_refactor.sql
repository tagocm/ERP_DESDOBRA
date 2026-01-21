-- ========================================================================
-- Financial Events - Event-Based Pre-Approval System
-- ========================================================================
-- Purpose: Refactor financial pre-approval to support event-based grouping
--          with installments, validation, and automatic AR/AP title generation
-- Strategy: Create new tables as SINGLE SOURCE OF TRUTH for pre-approval
-- Migration Path: Existing postings → events (1-to-1 with 1 installment)
--
-- IMPORTANT: financial_events is now the SOURCE OF TRUTH for pre-approval
--            financial_postings becomes LEGACY (read-only, deprecated)
--            New triggers create events, NOT postings
-- ========================================================================

-- ========================================================================
-- 1. FINANCIAL EVENTS (Parent - Business Events)
-- ========================================================================

CREATE TABLE IF NOT EXISTS financial_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Event Origin
    origin_type TEXT NOT NULL CHECK (origin_type IN ('SALE', 'PURCHASE', 'EXPENSE', 'MANUAL')),
    origin_id UUID, -- sales_document_id, purchase_order_id, etc (nullable for manual)
    origin_reference TEXT, -- Fallback identifier (e.g. "Pedido #123")
    
    -- Partner (Client or Supplier)
    partner_id UUID REFERENCES organizations(id),
    partner_name TEXT, -- Snapshot for display (denormalized)
    
    -- Financial Classification
    direction TEXT NOT NULL CHECK (direction IN ('AR', 'AP')),
    issue_date DATE NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    
    -- Workflow Status
    -- pendente: waiting for review/approval
    -- em_atencao: has validation issues, needs attention
    -- aprovando: transitional state during approval (atomic lock)
    -- aprovado: approved and title created (removed from queue)
    -- reprovado: rejected (audit only)
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_atencao', 'aprovando', 'aprovado', 'reprovado')),
    
    -- Approval/Rejection
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    approval_snapshot JSONB, -- Frozen state at approval time
    
    rejected_by UUID REFERENCES auth.users(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Attention Flag
    attention_marked_by UUID REFERENCES auth.users(id),
    attention_marked_at TIMESTAMPTZ,
    attention_reason TEXT,
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint for idempotency (same origin = same event)
    CONSTRAINT financial_events_origin_unique UNIQUE (company_id, origin_type, origin_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_events_company ON financial_events(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_events_status ON financial_events(status);
CREATE INDEX IF NOT EXISTS idx_financial_events_direction ON financial_events(direction);
CREATE INDEX IF NOT EXISTS idx_financial_events_partner ON financial_events(partner_id);
CREATE INDEX IF NOT EXISTS idx_financial_events_created ON financial_events(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_financial_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_financial_events_updated_at
    BEFORE UPDATE ON financial_events
    FOR EACH ROW
    EXECUTE FUNCTION update_financial_events_updated_at();

-- RLS Policies
ALTER TABLE financial_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_events_multi_tenant"
ON financial_events
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id 
    FROM company_members 
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id 
    FROM company_members 
    WHERE auth_user_id = auth.uid()
  )
);

COMMENT ON TABLE financial_events IS 'Business events (sales, purchases, expenses) pending or approved for financial processing';

-- ========================================================================
-- 2. FINANCIAL EVENT INSTALLMENTS (Pre-Titles/Parcelas)
-- ========================================================================

CREATE TABLE IF NOT EXISTS financial_event_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES financial_events(id) ON DELETE CASCADE,
    
    -- Installment Info
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    
    -- Payment Details
    payment_condition TEXT, -- e.g. "30 dias", "À vista"
    payment_method TEXT, -- e.g. "Boleto", "PIX"
    
    -- Accounting Classification (optional, can be set on approval)
    suggested_account_id UUID, -- REFERENCES financial_accounts(id) if exists
    category_id UUID, -- REFERENCES categories(id) if exists
    cost_center_id UUID, -- REFERENCES cost_centers(id) if exists
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT financial_event_installments_unique UNIQUE (event_id, installment_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_event_installments_event ON financial_event_installments(event_id);
CREATE INDEX IF NOT EXISTS idx_financial_event_installments_due ON financial_event_installments(due_date);

-- Updated_at trigger
CREATE TRIGGER trigger_financial_event_installments_updated_at
    BEFORE UPDATE ON financial_event_installments
    FOR EACH ROW
    EXECUTE FUNCTION update_financial_events_updated_at();

-- RLS Policies (inherit from parent event)
ALTER TABLE financial_event_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_event_installments_multi_tenant"
ON financial_event_installments
FOR ALL
TO authenticated
USING (
  event_id IN (
    SELECT id FROM financial_events 
    WHERE company_id IN (
      SELECT company_id 
      FROM company_members 
      WHERE auth_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  event_id IN (
    SELECT id FROM financial_events 
    WHERE company_id IN (
      SELECT company_id 
      FROM company_members 
      WHERE auth_user_id = auth.uid()
    )
  )
);

COMMENT ON TABLE financial_event_installments IS 'Pre-title installments (parcelas) for financial events before approval';

-- ========================================================================
-- 3. LINK AR/AP TITLES TO SOURCE EVENTS
-- ========================================================================

-- Add source_event_id to ar_titles (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ar_titles' AND column_name = 'source_event_id'
  ) THEN
    ALTER TABLE ar_titles ADD COLUMN source_event_id UUID REFERENCES financial_events(id);
    CREATE INDEX IF NOT EXISTS idx_ar_titles_source_event ON ar_titles(source_event_id);
  END IF;
END $$;

-- Add source_event_id to ap_titles (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ap_titles' AND column_name = 'source_event_id'
  ) THEN
    ALTER TABLE ap_titles ADD COLUMN source_event_id UUID REFERENCES financial_events(id);
    CREATE INDEX IF NOT EXISTS idx_ap_titles_source_event ON ap_titles(source_event_id);
  END IF;
END $$;

-- ========================================================================
-- 4. MIGRATE EXISTING FINANCIAL_POSTINGS TO EVENTS
-- ========================================================================

-- Migrate existing postings to events (1-to-1 with 1 installment each)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_postings') THEN
        
        -- Create Events from Postings
        INSERT INTO financial_events (
            id,
            company_id,
            origin_type,
            origin_id,
            origin_reference,
            partner_id,
            partner_name,
            direction,
            issue_date,
            total_amount,
            status,
            approved_by,
            approved_at,
            rejected_at,
            notes,
            created_at,
            updated_at
        )
        SELECT 
            fp.id, -- Keep same ID for reference
            sd.company_id,
            'SALE' as origin_type,
            fp.sales_document_id as origin_id,
            'Pedido #' || sd.document_number as origin_reference,
            sd.client_id as partner_id,
            org.trade_name as partner_name,
            fp.type as direction, -- AR or AP
            COALESCE(sd.date_issued, fp.created_at::DATE) as issue_date,
            fp.amount_total,
            CASE 
                WHEN fp.status = 'PENDING_APPROVAL' THEN 'pendente'
                WHEN fp.status = 'APPROVED' THEN 'aprovado'
                WHEN fp.status = 'REJECTED' THEN 'reprovado'
                WHEN fp.status = 'EM_ATENCAO' THEN 'em_atencao'
                ELSE 'pendente'
            END as status,
            fp.approved_by,
            fp.approved_at,
            CASE WHEN fp.status = 'REJECTED' THEN fp.created_at END as rejected_at,
            fp.notes,
            fp.created_at,
            fp.created_at
        FROM financial_postings fp
        JOIN sales_documents sd ON fp.sales_document_id = sd.id
        LEFT JOIN organizations org ON sd.client_id = org.id
        WHERE NOT EXISTS (
            SELECT 1 FROM financial_events fe 
            WHERE fe.id = fp.id
        )
        ON CONFLICT (company_id, origin_type, origin_id) DO NOTHING;

        -- Create single installment for each migrated event
        INSERT INTO financial_event_installments (
            event_id,
            installment_number,
            due_date,
            amount,
            payment_condition
        )
        SELECT 
            fp.id as event_id,
            1 as installment_number,
            COALESCE(sd.date_issued, fp.created_at::DATE) + INTERVAL '30 days' as due_date,
            fp.amount_total as amount,
            '30 dias' as payment_condition
        FROM financial_postings fp
        JOIN sales_documents sd ON fp.sales_document_id = sd.id
        WHERE NOT EXISTS (
            SELECT 1 FROM financial_event_installments fei 
            WHERE fei.event_id = fp.id
        );
        
    END IF;
END $$;

-- ========================================================================
-- 5. UPDATE TRIGGER TO CREATE EVENTS INSTEAD OF POSTINGS
-- ========================================================================

-- Replace old trigger function
CREATE OR REPLACE FUNCTION public.handle_sales_order_logistic_change_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_partner_name TEXT;
BEGIN
    -- When Logistic Status changes TO 'em_rota' (from anything else)
    IF NEW.status_logistic = 'em_rota' AND (OLD.status_logistic IS DISTINCT FROM 'em_rota') THEN
        
        -- Get partner name
        SELECT trade_name INTO v_partner_name 
        FROM organizations 
        WHERE id = NEW.client_id;
        
        -- Create Financial Event (with conflict handling)
        INSERT INTO financial_events (
            company_id,
            origin_type,
            origin_id,
            origin_reference,
            partner_id,
            partner_name,
            direction,
            issue_date,
            total_amount,
            status
        )
        VALUES (
            NEW.company_id,
            'SALE',
            NEW.id,
            'Pedido #' || NEW.document_number,
            NEW.client_id,
            COALESCE(v_partner_name, 'Cliente não identificado'),
            'AR',
            COALESCE(NEW.date_issued, CURRENT_DATE),
            COALESCE(NEW.total_amount, 0),
            'pendente'
        )
        ON CONFLICT (company_id, origin_type, origin_id) DO NOTHING;
        
        -- Create default installment (single payment, 30 days)
        INSERT INTO financial_event_installments (
            event_id,
            installment_number,
            due_date,
            amount,
            payment_condition
        )
        SELECT 
            fe.id,
            1,
            COALESCE(NEW.date_issued, CURRENT_DATE) + INTERVAL '30 days',
            COALESCE(NEW.total_amount, 0),
            '30 dias'
        FROM financial_events fe
        WHERE fe.origin_type = 'SALE' 
          AND fe.origin_id = NEW.id
          AND NOT EXISTS (
              SELECT 1 FROM financial_event_installments fei 
              WHERE fei.event_id = fe.id
          );
        
        -- Update Financial Status of the Order
        NEW.financial_status := 'pending';
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger to use new function
DROP TRIGGER IF EXISTS on_sales_logistic_update ON sales_documents;
CREATE TRIGGER on_sales_logistic_update
    BEFORE UPDATE OF status_logistic ON sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION handle_sales_order_logistic_change_v2();

-- ========================================================================
-- VERIFICATION
-- ========================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FINANCIAL EVENTS MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Events created: %', (SELECT COUNT(*) FROM financial_events);
  RAISE NOTICE 'Installments created: %', (SELECT COUNT(*) FROM financial_event_installments);
END $$;
