-- Migration: Fix Order Number Trigger to respect Draft status and Doc Type
-- Description: 
-- 1. Draft Orders (doc_type='order' AND status='draft') should NOT get a number.
-- 2. Proposals (doc_type='proposal') SHOULD get a number (Orçamento).
-- 3. Confirmed Orders (any status <> 'draft') SHOULD get a number.

CREATE OR REPLACE FUNCTION public.assign_sales_order_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign number if:
    -- 1. It is currently NULL
    -- 2. AND (Status is NOT 'draft' OR DocType is 'proposal')
    --    This ensures 'order' drafts are skipped (NULL number), but 'proposal' drafts get a number.
    IF NEW.document_number IS NULL AND (NEW.status_commercial <> 'draft' OR NEW.doc_type = 'proposal') THEN
        NEW.document_number := nextval('public.sales_order_number_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
