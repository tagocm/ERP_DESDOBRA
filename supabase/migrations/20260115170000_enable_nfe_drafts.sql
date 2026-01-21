-- Enable Draft Status and Snapshot for NFe
ALTER TABLE public.sales_document_nfes ADD COLUMN IF NOT EXISTS draft_snapshot JSONB;

-- Drop check constraint safely
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_document_nfes_status_check') THEN 
        ALTER TABLE public.sales_document_nfes DROP CONSTRAINT sales_document_nfes_status_check; 
    END IF; 
END $$;

-- Add updated check constraint
ALTER TABLE public.sales_document_nfes ADD CONSTRAINT sales_document_nfes_status_check 
CHECK (status IN ('draft', 'authorized', 'cancelled', 'processing', 'error'));

-- Notify schema reloading
NOTIFY pgrst, 'reload config';
