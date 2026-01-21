-- Migration: Add All Missing Columns to sales_document_items
-- Description: Ensures all columns exist in sales_document_items

DO $$
BEGIN
    -- Only proceed if table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_document_items') THEN
        
        -- discount_amount
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_schema = 'public' 
                      AND table_name = 'sales_document_items' 
                      AND column_name = 'discount_amount') THEN
            ALTER TABLE public.sales_document_items ADD COLUMN discount_amount NUMERIC(15, 2) DEFAULT 0;
        END IF;

        -- unit_price
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_schema = 'public' 
                      AND table_name = 'sales_document_items' 
                      AND column_name = 'unit_price') THEN
            ALTER TABLE public.sales_document_items ADD COLUMN unit_price NUMERIC(15, 4) NOT NULL DEFAULT 0;
        END IF;

        -- total_amount
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_schema = 'public' 
                      AND table_name = 'sales_document_items' 
                      AND column_name = 'total_amount') THEN
            ALTER TABLE public.sales_document_items ADD COLUMN total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;
        END IF;

        -- quantity
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_schema = 'public' 
                      AND table_name = 'sales_document_items' 
                      AND column_name = 'quantity') THEN
            ALTER TABLE public.sales_document_items ADD COLUMN quantity NUMERIC(15, 4) NOT NULL DEFAULT 1;
        END IF;

        -- notes
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_schema = 'public' 
                      AND table_name = 'sales_document_items' 
                      AND column_name = 'notes') THEN
            ALTER TABLE public.sales_document_items ADD COLUMN notes TEXT;
        END IF;

        -- qty_base (for weight calculations)
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_schema = 'public' 
                      AND table_name = 'sales_document_items' 
                      AND column_name = 'qty_base') THEN
            ALTER TABLE public.sales_document_items ADD COLUMN qty_base NUMERIC(15, 4);
        END IF;

        -- packaging_id
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_schema = 'public' 
                      AND table_name = 'sales_document_items' 
                      AND column_name = 'packaging_id') THEN
            ALTER TABLE public.sales_document_items ADD COLUMN packaging_id UUID;
        END IF;

    END IF;
END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
