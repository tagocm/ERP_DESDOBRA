-- 1. Fix: Prevent valid order number assignment for Drafts
CREATE OR REPLACE FUNCTION public.assign_sales_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only assign number if it's an Order AND Status is NOT draft
    -- If status becomes confirmed/sent later, we assign then.
    IF NEW.doc_type = 'order' AND NEW.document_number IS NULL AND NEW.status_commercial != 'draft' THEN
        NEW.document_number := public.get_next_sales_number(NEW.company_id);
    END IF;
    
    -- If changing from proposal to order OR from draft to active status
    IF OLD.doc_type = 'proposal' AND NEW.doc_type = 'order' AND NEW.document_number IS NULL THEN
         NEW.document_number := public.get_next_sales_number(NEW.company_id);
    END IF;

    -- If changing from draft to something else (e.g. confirmed) and still no number
    IF OLD.status_commercial = 'draft' AND NEW.status_commercial != 'draft' AND NEW.doc_type = 'order' AND NEW.document_number IS NULL THEN
         NEW.document_number := public.get_next_sales_number(NEW.company_id);
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Add Freight Details columns to sales_documents
ALTER TABLE public.sales_documents
ADD COLUMN IF NOT EXISTS freight_mode TEXT CHECK (freight_mode IN ('cif', 'fob', 'exw', 'sender', 'recipient', 'none', 'third_party')),
ADD COLUMN IF NOT EXISTS volumes_qty NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS volumes_species TEXT,
ADD COLUMN IF NOT EXISTS volumes_brand TEXT,
ADD COLUMN IF NOT EXISTS volumes_gross_weight_kg NUMERIC(15,3), -- Manual override or snapshot
ADD COLUMN IF NOT EXISTS volumes_net_weight_kg NUMERIC(15,3);   -- Manual override or snapshot

-- Comment fields
COMMENT ON COLUMN public.sales_documents.freight_mode IS 'cif, fob, exw (retira), third_party, etc.';
