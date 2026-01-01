-- FIX: Correct gross weight calculation
-- The issue: trigger is not using the product's gross_weight_g_base correctly

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_update_gross_weight ON sales_document_items;
DROP TRIGGER IF EXISTS trigger_update_order_weights ON sales_document_items;
DROP TRIGGER IF EXISTS trigger_update_weights ON sales_document_items;

-- Create CORRECT function
CREATE OR REPLACE FUNCTION update_sales_document_weights()
RETURNS TRIGGER AS $$
DECLARE
    v_document_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_document_id := OLD.document_id;
    ELSE
        v_document_id := NEW.document_id;
    END IF;

    -- Debug: Let's see what we're calculating
    RAISE NOTICE 'Updating weights for document_id: %', v_document_id;

    UPDATE sales_documents
    SET 
        total_weight_kg = (
            SELECT COALESCE(SUM(COALESCE(si.total_weight_kg, 0)), 0)
            FROM sales_document_items si
            WHERE si.document_id = v_document_id
        ),
        total_gross_weight_kg = (
            SELECT COALESCE(SUM(
                -- IMPORTANT: Use product gross weight if available
                CASE 
                    WHEN i.gross_weight_g_base IS NOT NULL AND i.gross_weight_g_base > 0
                    THEN (i.gross_weight_g_base / 1000.0) * COALESCE(si.quantity, 0)
                    ELSE COALESCE(si.total_weight_kg, 0) * 1.1
                END
            ), 0)
            FROM sales_document_items si
            LEFT JOIN items i ON i.id = si.item_id
            WHERE si.document_id = v_document_id
        )
    WHERE id = v_document_id;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_gross_weight
AFTER INSERT OR UPDATE OR DELETE ON sales_document_items
FOR EACH ROW
EXECUTE FUNCTION update_sales_document_weights();

-- FORCE recalculation of ALL orders
UPDATE sales_documents sd
SET 
    total_weight_kg = (
        SELECT COALESCE(SUM(COALESCE(si.total_weight_kg, 0)), 0)
        FROM sales_document_items si
        WHERE si.document_id = sd.id
    ),
    total_gross_weight_kg = (
        SELECT COALESCE(SUM(
            CASE 
                WHEN i.gross_weight_g_base IS NOT NULL AND i.gross_weight_g_base > 0
                THEN (i.gross_weight_g_base / 1000.0) * COALESCE(si.quantity, 0)
                ELSE COALESCE(si.total_weight_kg, 0) * 1.1
            END
        ), 0)
        FROM sales_document_items si
        LEFT JOIN items i ON i.id = si.item_id
        WHERE si.document_id = sd.id
    )
WHERE sd.deleted_at IS NULL;

-- Verify the fix
SELECT 
    document_number,
    total_weight_kg as peso_liquido,
    total_gross_weight_kg as peso_bruto,
    CASE 
        WHEN total_weight_kg > 0 
        THEN ROUND((total_gross_weight_kg / total_weight_kg - 1) * 100, 1)
        ELSE 0 
    END as diff_percentage
FROM sales_documents
WHERE deleted_at IS NULL
AND document_number IN (67, 66, 64, 63, 62)
ORDER BY document_number DESC;

-- Show detailed calculation for order 67
SELECT 
    'Order 67 Detail' as info,
    i.name,
    si.quantity,
    i.gross_weight_g_base,
    (i.gross_weight_g_base / 1000.0) as gross_per_unit_kg,
    (i.gross_weight_g_base / 1000.0) * si.quantity as total_gross_kg
FROM sales_documents sd
JOIN sales_document_items si ON si.document_id = sd.id
LEFT JOIN items i ON i.id = si.item_id
WHERE sd.document_number = 67;
