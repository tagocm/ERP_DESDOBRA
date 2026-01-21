-- Migration: Ensure Sales Documents Date Columns
-- Description: Ensures date_issued and other date columns exist in sales_documents

DO $$
BEGIN
    -- 1. date_issued
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'date_issued') THEN
        ALTER TABLE public.sales_documents ADD COLUMN date_issued DATE DEFAULT CURRENT_DATE;
    END IF;

    -- 2. valid_until (for proposals)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'valid_until') THEN
        ALTER TABLE public.sales_documents ADD COLUMN valid_until DATE;
    END IF;

    -- 3. delivery_date
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'delivery_date') THEN
        ALTER TABLE public.sales_documents ADD COLUMN delivery_date DATE;
    END IF;

    -- 4. scheduled_delivery_date (added later, ensure it exists)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'scheduled_delivery_date') THEN
        ALTER TABLE public.sales_documents ADD COLUMN scheduled_delivery_date DATE;
    END IF;

END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
