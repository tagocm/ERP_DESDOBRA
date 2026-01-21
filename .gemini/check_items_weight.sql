
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'items' AND column_name LIKE '%weight%';
