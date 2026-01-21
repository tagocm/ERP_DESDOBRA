
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales_document_items' 
ORDER BY column_name;
