-- Investigation migration
DO $$
DECLARE
    info TEXT;
BEGIN
    SELECT count(*)::text INTO info FROM public.sales_document_payments;
    RAISE NOTICE 'Table sales_document_payments exists with % rows', info;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error accessing table: %', SQLERRM;
END $$;
