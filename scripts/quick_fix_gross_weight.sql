-- QUICK FIX: Force update gross weight NOW

-- Step 1: Update the specific order you're looking at
-- Replace 'NOVO_PEDIDO' with the actual document number if different
UPDATE sales_documents sd
SET total_gross_weight_kg = (
    SELECT COALESCE(SUM(
        COALESCE(
            (i.gross_weight_g_base / 1000.0) * COALESCE(si.quantity, 0),
            COALESCE(si.total_weight_kg, 0) * 1.1
        )
    ), 0)
    FROM sales_document_items si
    LEFT JOIN items i ON i.id = si.item_id
    WHERE si.document_id = sd.id
)
WHERE sd.deleted_at IS NULL
AND (sd.document_number IN (64, 65, 66, 67, 68, 69, 70) OR sd.total_gross_weight_kg = 0);

-- Step 2: Show results
SELECT 
    document_number,
    total_weight_kg as peso_liquido_kg,
    total_gross_weight_kg as peso_bruto_kg,
    ROUND((total_gross_weight_kg / NULLIF(total_weight_kg, 0) - 1) * 100, 1) as percentual_embalagem
FROM sales_documents
WHERE deleted_at IS NULL
AND total_weight_kg > 0
ORDER BY created_at DESC
LIMIT 10;
