
-- Check if FK exists between item_fiscal_profiles and items
SELECT 
    conname AS constraint_name, 
    conrelid::regclass AS table_name, 
    confrelid::regclass AS foreign_table_name, 
    a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE conrelid = 'public.item_fiscal_profiles'::regclass
  AND confrelid = 'public.items'::regclass;

-- Force reload schema cache just in case
NOTIFY pgrst, 'reload schema';
