-- Add document_number column to purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS document_number BIGINT;

-- Unique constraint for number per company (partial index where number is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_number ON public.purchase_orders(company_id, document_number) WHERE document_number IS NOT NULL;

-- Sequence Table (Per Company)
CREATE TABLE IF NOT EXISTS public.purchase_sequences (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    last_number BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for sequences
ALTER TABLE public.purchase_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view/update purchase sequences of their company" ON public.purchase_sequences
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

-- Function to get next number
CREATE OR REPLACE FUNCTION public.get_next_purchase_number(p_company_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_next BIGINT;
BEGIN
    INSERT INTO public.purchase_sequences (company_id, last_number)
    VALUES (p_company_id, 0)
    ON CONFLICT (company_id) DO NOTHING;
    
    UPDATE public.purchase_sequences
    SET last_number = last_number + 1,
        updated_at = now()
    WHERE company_id = p_company_id
    RETURNING last_number INTO v_next;
    
    RETURN v_next;
END;
$$;

-- Trigger to assign number on convert to Order or creation of Order
-- Only assign if document_number is null
CREATE OR REPLACE FUNCTION public.assign_purchase_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.document_number IS NULL THEN
        NEW.document_number := public.get_next_purchase_number(NEW.company_id);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_order_number ON public.purchase_orders;

CREATE TRIGGER trg_purchase_order_number
    BEFORE INSERT ON public.purchase_orders
    FOR EACH ROW
    EXECUTE PROCEDURE public.assign_purchase_order_number();
