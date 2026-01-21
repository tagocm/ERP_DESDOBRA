-- check carrier_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'carrier_id') THEN
        RAISE EXCEPTION 'carrier_id IS MISSING';
    END IF;
END $$;
