
-- Fix Proposal Numbering: Only Order Drafts should NOT have numbers.
-- Proposals (Orçamentos) MUST have numbers.

CREATE OR REPLACE FUNCTION public.assign_sales_order_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Assign number IF:
    -- 1. Currently NULL
    -- 2. It is NOT a Draft Order.
    --    (Draft Orders are the ONLY thing that shouldn't have a number)
    
    IF NEW.document_number IS NULL 
       AND NOT (NEW.status_commercial = 'draft' AND COALESCE(NEW.doc_type, 'order') = 'order')
    THEN
        NEW.document_number := nextval('public.sales_order_number_seq');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
