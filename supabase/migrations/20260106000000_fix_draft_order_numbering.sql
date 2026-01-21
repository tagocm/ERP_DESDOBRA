-- Fix draft orders consuming sequence numbers
-- Replace the base trigger to exclude drafts from number assignment

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trg_sales_order_number ON public.sales_documents;
DROP FUNCTION IF EXISTS public.assign_sales_order_number();

-- Create updated function that skips drafts
CREATE OR REPLACE FUNCTION public.assign_sales_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only assign numbers to NON-DRAFT orders
    -- This prevents wasted sequence numbers when users create/abandon drafts
    IF NEW.doc_type = 'order' 
       AND NEW.document_number IS NULL 
       AND NEW.status_commercial != 'draft' THEN
        NEW.document_number := public.get_next_sales_number(NEW.company_id);
    END IF;
    
    -- Handle conversion from proposal to order (also skip drafts)
    IF TG_OP = 'UPDATE' 
       AND OLD.doc_type = 'proposal' 
       AND NEW.doc_type = 'order' 
       AND NEW.document_number IS NULL 
       AND NEW.status_commercial != 'draft' THEN
        NEW.document_number := public.get_next_sales_number(NEW.company_id);
    END IF;

    -- Handle draft-to-confirmed transition (assign number on confirmation)
    IF TG_OP = 'UPDATE'
       AND NEW.doc_type = 'order'
       AND NEW.document_number IS NULL
       AND OLD.status_commercial = 'draft'
       AND NEW.status_commercial != 'draft' THEN
        NEW.document_number := public.get_next_sales_number(NEW.company_id);
    END IF;

    RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trg_sales_order_number
    BEFORE INSERT OR UPDATE ON public.sales_documents
    FOR EACH ROW
    EXECUTE PROCEDURE public.assign_sales_order_number();

COMMENT ON FUNCTION public.assign_sales_order_number() IS 
'Assigns document_number to confirmed orders only (skips drafts to prevent sequence number waste)';
