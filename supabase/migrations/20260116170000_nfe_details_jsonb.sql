
-- Convert details column to JSONB
-- We use a USING clause to handle existing data. 
-- If data is already valid JSON string, it casts fine.
-- If data is the messed up "char map", it is ALSO valid JSON object string.
-- Normalization script will fix the content, this just fixes the type.

ALTER TABLE public.sales_document_nfes
ALTER COLUMN details TYPE JSONB 
USING details::jsonb;

-- Ensure default is empty object not null if desired, or leave nullable.
-- ALTER TABLE public.sales_document_nfes ALTER COLUMN details SET DEFAULT '{}'::jsonb;
