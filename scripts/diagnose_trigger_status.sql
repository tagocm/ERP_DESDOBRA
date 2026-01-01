-- Diagnostic: Check if trigger exists and is working

-- 1. Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'sales_document_items'
ORDER BY trigger_name;

-- 2. Check if function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_name LIKE '%weight%'
ORDER BY routine_name;

-- 3. Check if column exists
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'sales_documents'
AND column_name LIKE '%weight%'
ORDER BY column_name;

-- 4. Check latest order (should be the new one)
SELECT 
    id,
    document_number,
    total_weight_kg,
    total_gross_weight_kg,
    created_at
FROM sales_documents
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check items of latest order
SELECT 
    sd.document_number,
    si.id as item_id,
    i.name as product_name,
    si.quantity,
    si.total_weight_kg as item_total_weight,
    i.gross_weight_g_base,
    i.net_weight_g_base
FROM sales_documents sd
JOIN sales_document_items si ON si.document_id = sd.id
LEFT JOIN items i ON i.id = si.item_id
WHERE sd.deleted_at IS NULL
ORDER BY sd.created_at DESC
LIMIT 10;
