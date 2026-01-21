
-- Check if FK exists
SELECT 
    conname AS constraint_name, 
    conrelid::regclass AS table_name, 
    confrelid::regclass AS foreign_table_name, 
    a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE conrelid = 'public.deliveries'::regclass
  AND confrelid = 'public.delivery_routes'::regclass;

-- Force reload again just in case
NOTIFY pgrst, 'reload schema';
