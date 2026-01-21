-- Query to find duplicate clients in organizations table
-- This checks for duplicates based on trade_name and document_number

-- Check for duplicate trade names
SELECT 
    trade_name,
    COUNT(*) as count,
    STRING_AGG(id::text, ', ') as ids,
    STRING_AGG(COALESCE(document_number, 'NULL'), ', ') as documents
FROM organizations
WHERE deleted_at IS NULL
GROUP BY trade_name
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Check for duplicate document numbers
SELECT 
    document_number,
    COUNT(*) as count,
    STRING_AGG(id::text, ', ') as ids,
    STRING_AGG(trade_name, ', ') as names
FROM organizations
WHERE deleted_at IS NULL 
  AND document_number IS NOT NULL
GROUP BY document_number
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Check for exact duplicates (same trade_name AND document_number)
SELECT 
    trade_name,
    document_number,
    COUNT(*) as count,
    STRING_AGG(id::text, ', ') as ids,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM organizations
WHERE deleted_at IS NULL
GROUP BY trade_name, document_number
HAVING COUNT(*) > 1
ORDER BY count DESC;
