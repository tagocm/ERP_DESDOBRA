-- Migration: Fix Sales Documents User Relation (Add Missing Column)
-- Description: Ensures sales_rep_id column exists and has proper FK.

DO $$
BEGIN
    -- 1. Ensure Column Exists
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'sales_rep_id') THEN
        ALTER TABLE public.sales_documents ADD COLUMN sales_rep_id UUID;
    END IF;

    -- 2. Ensure FK Exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema 
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'sales_documents' 
          AND kcu.column_name = 'sales_rep_id'
          AND tc.table_schema = 'public'
    ) THEN
        -- Add FK
        ALTER TABLE public.sales_documents 
        ADD CONSTRAINT sales_documents_sales_rep_id_fkey 
        FOREIGN KEY (sales_rep_id) 
        REFERENCES public.users(id);
    END IF;

END $$;

-- Force Schema Reload
NOTIFY pgrst, 'reload schema';
