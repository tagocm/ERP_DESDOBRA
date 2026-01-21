-- Migration: Accounts Payable (AP) Module & AR Enhancements
-- Description: Creates AP structure mirroring AR and adds attention status for pre-approval flow.

-- 1. Add Attention Fields to AR Titles
ALTER TABLE ar_titles 
ADD COLUMN IF NOT EXISTS attention_status text DEFAULT NULL, -- 'EM_ATENCAO' or null
ADD COLUMN IF NOT EXISTS attention_reason text DEFAULT NULL;

-- 2. AP Titles (Cabeçalho do Contas a Pagar)
CREATE TABLE IF NOT EXISTS ap_titles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    purchase_order_id uuid REFERENCES purchase_orders(id), -- Optional: could include manual bills
    supplier_id uuid NOT NULL REFERENCES organizations(id),
    
    document_number text, -- NFe number or internal ID
    
    status text NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, OPEN, PAID, CANCELLED
    
    amount_total numeric NOT NULL,
    amount_paid numeric NOT NULL DEFAULT 0,
    amount_open numeric NOT NULL DEFAULT 0,
    
    payment_terms_snapshot text,
    payment_method_snapshot text,
    
    date_issued date DEFAULT CURRENT_DATE,
    due_date date, -- Relevant for single payment or reference
    
    -- Attention fields for Pre-Approval
    attention_status text DEFAULT NULL,
    attention_reason text DEFAULT NULL,

    created_at timestamptz DEFAULT now(),
    approved_at timestamptz,
    approved_by uuid REFERENCES auth.users(id),
    
    CONSTRAINT ap_titles_purchase_order_unique UNIQUE (purchase_order_id)
);

-- 3. AP Installments (Parcelas a Pagar)
CREATE TABLE IF NOT EXISTS ap_installments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    ap_title_id uuid NOT NULL REFERENCES ap_titles(id) ON DELETE CASCADE,
    
    installment_number int NOT NULL,
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
    
    UNIQUE(ap_title_id, installment_number)
);

-- 4. AP Payments (Histórico de Pagamentos Realizados)
CREATE TABLE IF NOT EXISTS ap_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    supplier_id uuid REFERENCES organizations(id),
    
    amount numeric NOT NULL,
    paid_at timestamptz NOT NULL,
    method text,
    reference text, 
    notes text,
    
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 5. AP Allocations (Payment -> Installment)
CREATE TABLE IF NOT EXISTS ap_payment_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL REFERENCES ap_payments(id) ON DELETE CASCADE,
    installment_id uuid NOT NULL REFERENCES ap_installments(id) ON DELETE CASCADE,
    
    amount_allocated numeric NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ap_titles_status ON ap_titles(status);
CREATE INDEX IF NOT EXISTS idx_ap_titles_supplier ON ap_titles(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ap_installments_title ON ap_installments(ap_title_id);
CREATE INDEX IF NOT EXISTS idx_ap_installments_due ON ap_installments(due_date);

-- RLS
ALTER TABLE ap_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for ap_titles" ON ap_titles FOR ALL USING (true);
CREATE POLICY "Enable all for ap_installments" ON ap_installments FOR ALL USING (true);
CREATE POLICY "Enable all for ap_payments" ON ap_payments FOR ALL USING (true);
CREATE POLICY "Enable all for ap_payment_allocations" ON ap_payment_allocations FOR ALL USING (true);

-- Trigger: Create AP Title from Purchase Order
CREATE OR REPLACE FUNCTION public.handle_purchase_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
    v_terms_name TEXT;
    v_mode_name TEXT;
    v_supplier_name TEXT;
    v_attention_status TEXT := NULL;
    v_attention_reason TEXT := NULL;
BEGIN
    -- Only run when status changes TO 'sent' (or 'received' if skipping sent)
    -- Logic: We create the pre-approval when it's SENT to supplier or RECEIVED.
    -- Let's stick to SENT as the earliest formal commitment, or RECEIVED if user wants 
    -- to validate only after receiving. 
    -- USER REQUEST: "Compras/Recebimento: criar ap_titles também em PENDING_APPROVAL"
    -- This implies trigger on 'received' or creation but typically financial is triggered 
    -- when liability is established. 'sent' is a commitment, 'received' is liability.
    -- Let's Trigger on 'sent' OR 'received' (if it wasn't created yet).
    -- But usually PO flow is: Draft -> Sent -> Received.
    -- If we trigger on 'sent', user can plan payment.
    
    -- Let's check if we should trigger.
    IF (NEW.status = 'sent' AND OLD.status != 'sent') OR 
       (NEW.status = 'received' AND OLD.status != 'received') THEN
       
        -- Idempotency check handled by ON CONFLICT below
        
        v_total := COALESCE(NEW.total_amount, 0);
        
        -- Check for missing info (Attention Logic)
        IF NEW.payment_terms_id IS NULL THEN
            v_attention_status := 'EM_ATENCAO';
            v_attention_reason := 'Condição de pagamento não informada.';
        ELSIF NEW.payment_mode_id IS NULL THEN
            v_attention_status := 'EM_ATENCAO';
            v_attention_reason := 'Modo de pagamento não informado.';
        END IF;

        -- Fetch snapshot names
        -- (Optional optimization: Just store IDs and join later, but schema uses snapshots)
        -- We'll just leave snapshots null or fetch if critical. 
        -- For now, relying on IDs in the order is safer, but AP table has snapshot columns.
        -- Let's fetch basic terms name if possible.
        IF NEW.payment_terms_id IS NOT NULL THEN
             SELECT name INTO v_terms_name FROM payment_terms WHERE id = NEW.payment_terms_id;
        END IF;

        INSERT INTO ap_titles (
            company_id,
            purchase_order_id,
            supplier_id,
            document_number,
            status,
            amount_total,
            amount_open,
            payment_terms_snapshot,
            date_issued,
            attention_status,
            attention_reason
        )
        VALUES (
            NEW.company_id,
            NEW.id,
            NEW.supplier_id,
            substring(NEW.id::text, 1, 8), -- Temporary doc number from ID
            'PENDING_APPROVAL',
            v_total,
            v_total, -- Fully open
            v_terms_name,
            CURRENT_DATE,
            v_attention_status,
            v_attention_reason
        )
        ON CONFLICT (purchase_order_id) DO NOTHING;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_purchase_order_status_change ON purchase_orders;
CREATE TRIGGER on_purchase_order_status_change
    AFTER UPDATE OF status ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_purchase_order_status_change();
