-- Migration: Sales Module
-- Created at: 2025-12-24 00:00:00

-- 1. Sales Documents (Header)
CREATE TABLE IF NOT EXISTS public.sales_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    
    -- Document Type
    doc_type TEXT NOT NULL CHECK (doc_type IN ('proposal', 'order')),
    document_number BIGINT, -- Sequence-based number per company
    
    -- Relationships
    client_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    sales_rep_id UUID REFERENCES public.users(id),
    price_table_id UUID REFERENCES public.price_tables(id),
    payment_terms_id UUID REFERENCES public.payment_terms(id),
    
    -- Dates
    date_issued DATE DEFAULT CURRENT_DATE,
    valid_until DATE, -- For proposals
    delivery_date DATE,
    
    -- Statuses
    -- Commercial: draft, sent, approved, confirmed, cancelled, lost
    status_commercial TEXT NOT NULL DEFAULT 'draft' CHECK (status_commercial IN ('draft', 'sent', 'approved', 'confirmed', 'cancelled', 'lost')),
    -- Logistic: pending, separation, expedition, delivered
    status_logistic TEXT NOT NULL DEFAULT 'pending' CHECK (status_logistic IN ('pending', 'separation', 'expedition', 'delivered')),
    -- Fiscal: none, authorized, cancelled, error
    status_fiscal TEXT NOT NULL DEFAULT 'none' CHECK (status_fiscal IN ('none', 'authorized', 'cancelled', 'error')),
    
    -- Flags
    is_antecipada BOOLEAN DEFAULT false,
    
    -- Totals
    subtotal_amount NUMERIC(15, 2) DEFAULT 0,
    discount_amount NUMERIC(15, 2) DEFAULT 0,
    freight_amount NUMERIC(15, 2) DEFAULT 0,
    total_amount NUMERIC(15, 2) DEFAULT 0,
    
    -- Delivery Info (Snapshot or override)
    delivery_address_json JSONB, -- Stores full address snapshot
    carrier_id UUID REFERENCES public.organizations(id),
    
    internal_notes TEXT,
    client_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Unique constraint for number per company (partial index where number is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_docs_number ON public.sales_documents(company_id, document_number) WHERE document_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_docs_company ON public.sales_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_docs_client ON public.sales_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_docs_status ON public.sales_documents(status_commercial);


-- 2. Sales Items
CREATE TABLE IF NOT EXISTS public.sales_document_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, -- Denormalized for RLS/Perf
    document_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    
    quantity NUMERIC(15, 4) NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 4) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15, 2) DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0, -- (qty * unit) - discount
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_items_doc ON public.sales_document_items(document_id);


-- 3. Sales Payments (Installments)
CREATE TABLE IF NOT EXISTS public.sales_document_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    
    installment_number INT NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    
    -- Integration with financial module (future)
    financial_title_id UUID, 
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_payments_doc ON public.sales_document_payments(document_id);


-- 4. Sales NF-e Links
CREATE TABLE IF NOT EXISTS public.sales_document_nfes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    
    nfe_number INT,
    nfe_series INT,
    nfe_key TEXT,
    
    status TEXT NOT NULL DEFAULT 'authorized', -- authorized, cancelled
    issued_at TIMESTAMPTZ DEFAULT now(),
    
    is_antecipada BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_nfes_doc ON public.sales_document_nfes(document_id);


-- 5. Audit Log / Events
CREATE TABLE IF NOT EXISTS public.sales_document_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL, -- status_change, edit, email_sent, nfe_emitted
    description TEXT,
    user_id UUID REFERENCES public.users(id),
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_events_doc ON public.sales_document_events(document_id);


-- 6. Sequence Table (Per Company)
CREATE TABLE IF NOT EXISTS public.sales_sequences (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    last_number BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);


-- Function to get next number
CREATE OR REPLACE FUNCTION public.get_next_sales_number(p_company_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_next BIGINT;
BEGIN
    INSERT INTO public.sales_sequences (company_id, last_number)
    VALUES (p_company_id, 0)
    ON CONFLICT (company_id) DO NOTHING;
    
    UPDATE public.sales_sequences
    SET last_number = last_number + 1,
        updated_at = now()
    WHERE company_id = p_company_id
    RETURNING last_number INTO v_next;
    
    RETURN v_next;
END;
$$;


-- Trigger to assign number on convert to Order or creation of Order
-- Only assign if doc_type = 'order' and document_number is null
CREATE OR REPLACE FUNCTION public.assign_sales_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.doc_type = 'order' AND NEW.document_number IS NULL THEN
        NEW.document_number := public.get_next_sales_number(NEW.company_id);
    END IF;
    
    -- If changing from proposal to order
    IF OLD.doc_type = 'proposal' AND NEW.doc_type = 'order' AND NEW.document_number IS NULL THEN
        NEW.document_number := public.get_next_sales_number(NEW.company_id);
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_order_number
    BEFORE INSERT OR UPDATE ON public.sales_documents
    FOR EACH ROW
    EXECUTE PROCEDURE public.assign_sales_order_number();


-- Triggers for Updated At
CREATE TRIGGER update_sales_docs_updated_at
    BEFORE UPDATE ON public.sales_documents
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_sales_items_updated_at
    BEFORE UPDATE ON public.sales_document_items
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- RLS Policies
-- Using the is_member_of helper or direct check

-- Documents
ALTER TABLE public.sales_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_docs_access" ON public.sales_documents
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

-- Items
ALTER TABLE public.sales_document_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_items_access" ON public.sales_document_items
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

-- Payments
ALTER TABLE public.sales_document_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_payments_access" ON public.sales_document_payments
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

-- NFEs
ALTER TABLE public.sales_document_nfes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_nfes_access" ON public.sales_document_nfes
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

-- Events
ALTER TABLE public.sales_document_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_events_access" ON public.sales_document_events
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

-- Sequence
ALTER TABLE public.sales_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_sequences_access" ON public.sales_sequences
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

