-- Migration: Enforce Unique Document Number per Company
-- Description: Ensures that no two clients from the same company can have the same CNPJ/CPF

DO $$
BEGIN
    -- 1. Drop the old unique index if it exists (on 'document' field)
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_organizations_company_document'
    ) THEN
        DROP INDEX public.idx_organizations_company_document;
    END IF;

    -- 2. Create/Recreate unique index on document_number
    -- This prevents duplicates while allowing NULL values
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_organizations_unique_document_number'
    ) THEN
        CREATE UNIQUE INDEX idx_organizations_unique_document_number 
        ON public.organizations(company_id, document_number) 
        WHERE document_number IS NOT NULL AND deleted_at IS NULL;
    END IF;

END $$;

-- Add comment
COMMENT ON INDEX public.idx_organizations_unique_document_number IS 
'Ensures no duplicate CNPJ/CPF per company. Allows NULL and ignores soft-deleted records.';

-- Force schema reload
NOTIFY pgrst, 'reload schema';
