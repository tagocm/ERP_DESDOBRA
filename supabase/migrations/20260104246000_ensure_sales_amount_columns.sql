-- Migration: Ensure Sales Documents Amount Columns
-- Description: Ensures all amount/total columns exist in sales_documents

DO $$
BEGIN
    -- 1. subtotal_amount
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'subtotal_amount') THEN
        ALTER TABLE public.sales_documents ADD COLUMN subtotal_amount NUMERIC(15, 2) DEFAULT 0;
    END IF;

    -- 2. discount_amount
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'discount_amount') THEN
        ALTER TABLE public.sales_documents ADD COLUMN discount_amount NUMERIC(15, 2) DEFAULT 0;
    END IF;

    -- 3. freight_amount
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'freight_amount') THEN
        ALTER TABLE public.sales_documents ADD COLUMN freight_amount NUMERIC(15, 2) DEFAULT 0;
    END IF;

    -- 4. total_amount
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'total_amount') THEN
        ALTER TABLE public.sales_documents ADD COLUMN total_amount NUMERIC(15, 2) DEFAULT 0;
    END IF;

    -- 5. total_weight_kg (added later)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'total_weight_kg') THEN
        ALTER TABLE public.sales_documents ADD COLUMN total_weight_kg NUMERIC(15, 3) DEFAULT 0;
    END IF;

    -- 6. total_gross_weight_kg (added later)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'total_gross_weight_kg') THEN
        ALTER TABLE public.sales_documents ADD COLUMN total_gross_weight_kg NUMERIC(15, 3) DEFAULT 0;
    END IF;

END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
