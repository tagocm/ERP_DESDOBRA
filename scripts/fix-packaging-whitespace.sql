-- Fix trailing whitespace in item_packaging
UPDATE item_packaging 
SET 
  label = TRIM(label),
  type = TRIM(type)
WHERE 
  label LIKE '% ' 
  OR label LIKE ' %'
  OR type LIKE '% '
  OR type LIKE ' %';

-- Show affected rows
SELECT COUNT(*) as fixed_rows FROM item_packaging 
WHERE label != TRIM(label) OR type != TRIM(type);
