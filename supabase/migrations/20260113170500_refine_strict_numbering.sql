
-- Refine Strict Numbering to allow Confirmed Proposals

CREATE OR REPLACE FUNCTION public.assign_sales_order_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Assign number ONLY if:
    -- 1. Currently NULL
    -- 2. Status is NOT 'draft' AND NOT 'budget'
    -- 3. DocType IS NOT 'proposal' UNLESS Status IS 'confirmed'
    IF NEW.document_number IS NULL 
       AND NEW.status_commercial <> 'draft' 
       AND NEW.status_commercial <> 'budget'
       AND (NEW.doc_type <> 'proposal' OR NEW.status_commercial = 'confirmed')
    THEN
        NEW.document_number := nextval('public.sales_order_number_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
