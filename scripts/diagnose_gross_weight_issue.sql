-- DIAGNOSTIC: Why gross weight is not showing

-- 1. Check if column exists and has data
SELECT 
    document_number,
    total_weight_kg,
    total_gross_weight_kg,
    created_at
FROM sales_documents
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 3;

-- 2. Check if snapshot column exists in items
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_document_items'
AND column_name LIKE '%weight%'
ORDER BY column_name;

-- 3. Check items of latest order
SELECT 
    sd.document_number,
    si.quantity,
    si.total_weight_kg as item_net_weight,
    si.gross_weight_kg_snapshot as item_gross_snapshot,
    i.name as product_name,
    i.gross_weight_g_base as product_gross_g,
    i.net_weight_g_base as product_net_g
FROM sales_documents sd
JOIN sales_document_items si ON si.document_id = sd.id
LEFT JOIN items i ON i.id = si.item_id
WHERE sd.deleted_at IS NULL
ORDER BY sd.created_at DESC, si.id
LIMIT 10;

-- 4. Check what triggers exist
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'sales_document_items'
ORDER BY trigger_name;

-- 5. Manual calculation test for latest order
SELECT 
    sd.document_number,
    sd.total_gross_weight_kg as current_gross_weight,
    (
        SELECT COALESCE(SUM(
            COALESCE(si.gross_weight_kg_snapshot, 0) * COALESCE(si.quantity, 0)
        ), 0)
        FROM sales_document_items si
        WHERE si.document_id = sd.id
    ) as calculated_from_snapshot,
    (
        SELECT COALESCE(SUM(
            COALESCE(
                (i.gross_weight_g_base / 1000.0) * COALESCE(si.quantity, 0),
                COALESCE(si.total_weight_kg, 0) * 1.1
            )
        ), 0)
        FROM sales_document_items si
        LEFT JOIN items i ON i.id = si.item_id
        WHERE si.document_id = sd.id
    ) as calculated_from_product
FROM sales_documents sd
WHERE sd.deleted_at IS NULL
ORDER BY sd.created_at DESC
LIMIT 3;
