-- DIAGNOSTIC: Check why gross weight equals net weight

-- 1. Check products in recent orders - do they have gross_weight_g_base?
SELECT 
    sd.document_number,
    i.name as product_name,
    i.sku,
    i.net_weight_g_base,
    i.gross_weight_g_base,
    CASE 
        WHEN i.gross_weight_g_base IS NULL THEN '❌ SEM PESO BRUTO'
        ELSE '✅ TEM PESO BRUTO'
    END as status,
    si.quantity,
    si.total_weight_kg as item_net_weight
FROM sales_documents sd
JOIN sales_document_items si ON si.document_id = sd.id
LEFT JOIN items i ON i.id = si.item_id
WHERE sd.document_number IN (67, 66, 64, 63, 62)
ORDER BY sd.document_number DESC, si.id;

-- 2. Show calculation breakdown for order 67
SELECT 
    'Order 67 Breakdown' as info,
    i.name as product,
    si.quantity,
    i.gross_weight_g_base as product_gross_g,
    i.net_weight_g_base as product_net_g,
    si.total_weight_kg as item_net_kg,
    CASE 
        WHEN i.gross_weight_g_base IS NOT NULL 
        THEN (i.gross_weight_g_base / 1000.0) * si.quantity
        ELSE si.total_weight_kg * 1.1
    END as calculated_gross_kg,
    CASE 
        WHEN i.gross_weight_g_base IS NOT NULL 
        THEN 'Using product gross weight'
        ELSE 'Using fallback (net * 1.1)'
    END as calculation_method
FROM sales_documents sd
JOIN sales_document_items si ON si.document_id = sd.id
LEFT JOIN items i ON i.id = si.item_id
WHERE sd.document_number = 67;

-- 3. Count products without gross weight
SELECT 
    COUNT(*) as total_products,
    SUM(CASE WHEN gross_weight_g_base IS NOT NULL THEN 1 ELSE 0 END) as with_gross_weight,
    SUM(CASE WHEN gross_weight_g_base IS NULL THEN 1 ELSE 0 END) as without_gross_weight,
    ROUND(
        SUM(CASE WHEN gross_weight_g_base IS NOT NULL THEN 1 ELSE 0 END)::numeric / 
        COUNT(*)::numeric * 100, 
        1
    ) as percentage_with_gross
FROM items
WHERE deleted_at IS NULL;
