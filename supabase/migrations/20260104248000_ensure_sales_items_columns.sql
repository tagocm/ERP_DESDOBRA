-- Migration: Ensure company_id in sales_document_items
-- Description: Adds company_id column if missing

DO $$
BEGIN
    -- Check if table exists first
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_document_items') THEN
        -- Add company_id if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_schema = 'public' 
                      AND table_name = 'sales_document_items' 
                      AND column_name = 'company_id') THEN
            -- Add as nullable first
            ALTER TABLE public.sales_document_items ADD COLUMN company_id UUID;
            
            -- Update existing rows to get company_id from parent document
            UPDATE public.sales_document_items sdi
            SET company_id = sd.company_id
            FROM public.sales_documents sd
            WHERE sdi.document_id = sd.id AND sdi.company_id IS NULL;
            
            -- Now make it NOT NULL
            ALTER TABLE public.sales_document_items ALTER COLUMN company_id SET NOT NULL;
            
            -- Add FK constraint
            ALTER TABLE public.sales_document_items 
            ADD CONSTRAINT sales_document_items_company_id_fkey 
            FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
