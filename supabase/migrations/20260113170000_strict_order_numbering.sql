
-- Strict Order Numbering to Prevent Gaps from Drafts/Proposals

CREATE OR REPLACE FUNCTION public.assign_sales_order_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Assign number ONLY if:
    -- 1. Currently NULL (Avoid re-assigning)
    -- 2. Status is NOT 'draft' AND NOT 'budget'
    -- 3. DocType IS NOT 'proposal' (Orçamentos should NOT consume official order numbers)
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

-- Ensure trigger is active
DROP TRIGGER IF EXISTS trigger_assign_sales_order_number ON public.sales_documents;
CREATE TRIGGER trigger_assign_sales_order_number
    BEFORE INSERT OR UPDATE ON public.sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_sales_order_number();
