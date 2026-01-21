-- check FK explicitly
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sales_document_items_packaging_id_fkey'
    ) THEN
        RAISE EXCEPTION 'FK sales_document_items_packaging_id_fkey IS MISSING';
    END IF;
END $$;
