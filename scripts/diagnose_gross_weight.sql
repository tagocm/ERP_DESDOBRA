-- Diagnostic: Check gross weight calculation for order 64

-- 1. Check if columns exist
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_documents'
AND column_name IN ('total_weight_kg', 'total_gross_weight_kg')
ORDER BY column_name;

-- 2. Check if items have gross_weight_g_base
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'items'
AND column_name IN ('net_weight_g_base', 'gross_weight_g_base')
ORDER BY column_name;

-- 3. Check order 64 details
SELECT 
    sd.id,
    sd.document_number,
    sd.total_weight_kg,
    sd.total_gross_weight_kg
FROM sales_documents sd
WHERE sd.document_number = 64;

-- 4. Check items in order 64 with their weights
SELECT 
    si.id as sales_item_id,
    si.item_id,
    i.name as product_name,
    si.quantity,
    si.weight_kg as item_weight_kg,
    i.net_weight_g_base,
    i.gross_weight_g_base,
    -- Calculate what gross weight should be
    COALESCE(i.gross_weight_g_base / 1000.0, si.weight_kg * 1.1) as calculated_gross_per_unit,
    COALESCE(i.gross_weight_g_base / 1000.0, si.weight_kg * 1.1) * si.quantity as calculated_gross_total
FROM sales_items si
JOIN items i ON i.id = si.item_id
JOIN sales_documents sd ON sd.id = si.sales_document_id
WHERE sd.document_number = 64
AND si.deleted_at IS NULL;

-- 5. Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_weights';
