-- Migration to fix order number sequence: Drop IDENTITY, use Nullable + Sequence + Trigger

-- 1. Create a sequence, starting from the current max document_number + 1
DO $$
DECLARE
    max_val BIGINT;
BEGIN
    SELECT COALESCE(MAX(document_number), 0) + 1 INTO max_val FROM public.sales_documents;
    
    -- Create sequence
    EXECUTE 'CREATE SEQUENCE IF NOT EXISTS public.sales_order_number_seq START ' || max_val;
END $$;

-- 2. Alter table: Drop IDENTITY, Make Nullable
ALTER TABLE public.sales_documents ALTER COLUMN document_number DROP IDENTITY IF EXISTS;
ALTER TABLE public.sales_documents ALTER COLUMN document_number DROP NOT NULL;
ALTER TABLE public.sales_documents ALTER COLUMN document_number SET DEFAULT NULL;

-- 3. Create Trigger Function
CREATE OR REPLACE FUNCTION public.assign_sales_order_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign number if:
    -- 1. It is currently NULL
    -- 2. The status is NOT 'draft' (i.e. it's being confirmed/sent)
    -- 3. OR if it is being inserted with a non-draft status directly
    IF NEW.document_number IS NULL AND NEW.status_commercial <> 'draft' THEN
        NEW.document_number := nextval('public.sales_order_number_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Trigger
DROP TRIGGER IF EXISTS trigger_assign_sales_order_number ON public.sales_documents;
CREATE TRIGGER trigger_assign_sales_order_number
    BEFORE INSERT OR UPDATE ON public.sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_sales_order_number();

-- 5. Force update existing drafts to have NULL document_number?
-- OPTIONAL: We might want to clear numbers from existing drafts so they don't look like real orders.
-- BUT: That might be risky if users rely on those numbers. Let's keep existing numbers for now.

-- 6. Ensure sequence ownership (optional good practice)
ALTER SEQUENCE public.sales_order_number_seq OWNED BY public.sales_documents.document_number;
