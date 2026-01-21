
-- Add updated_at column
ALTER TABLE public.sales_document_nfes
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create/Reuse trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create Trigger
DROP TRIGGER IF EXISTS update_sales_document_nfes_updated_at ON public.sales_document_nfes;

CREATE TRIGGER update_sales_document_nfes_updated_at
BEFORE UPDATE ON public.sales_document_nfes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
