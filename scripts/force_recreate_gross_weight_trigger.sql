-- FORCE RECREATE TRIGGER: Fix gross weight calculation
-- This will drop and recreate the trigger with correct logic

-- Step 1: Drop ALL existing weight triggers
DROP TRIGGER IF EXISTS trigger_update_gross_weight ON sales_document_items;
DROP TRIGGER IF EXISTS trigger_update_weights ON sales_document_items;
DROP TRIGGER IF EXISTS update_sales_order_total_weight_delta ON sales_document_items;

-- Step 2: Create the correct function
CREATE OR REPLACE FUNCTION update_sales_document_weights()
RETURNS TRIGGER AS $$
DECLARE
    v_document_id UUID;
BEGIN
    -- Get document_id from NEW or OLD
    IF TG_OP = 'DELETE' THEN
        v_document_id := OLD.document_id;
    ELSE
        v_document_id := NEW.document_id;
    END IF;

    -- Update sales_documents with calculated weights
    UPDATE sales_documents
    SET 
        -- Net weight: sum of item total_weight_kg
        total_weight_kg = (
            SELECT COALESCE(SUM(COALESCE(si.total_weight_kg, 0)), 0)
            FROM sales_document_items si
            WHERE si.document_id = v_document_id
        ),
        -- Gross weight: use product gross_weight_g_base or fallback to net * 1.1
        total_gross_weight_kg = (
            SELECT COALESCE(SUM(
                COALESCE(
                    -- If product has gross weight, use it (convert g to kg)
                    (i.gross_weight_g_base / 1000.0) * COALESCE(si.quantity, 0),
                    -- Otherwise, use net weight * 1.1 (10% packaging)
                    COALESCE(si.total_weight_kg, 0) * 1.1
                )
            ), 0)
            FROM sales_document_items si
            LEFT JOIN items i ON i.id = si.item_id
            WHERE si.document_id = v_document_id
        )
    WHERE id = v_document_id;
    
    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create the trigger
CREATE TRIGGER trigger_update_gross_weight
AFTER INSERT OR UPDATE OR DELETE ON sales_document_items
FOR EACH ROW
EXECUTE FUNCTION update_sales_document_weights();

-- Step 4: Force recalculation of ALL orders
UPDATE sales_documents sd
SET 
    total_weight_kg = (
        SELECT COALESCE(SUM(COALESCE(si.total_weight_kg, 0)), 0)
        FROM sales_document_items si
        WHERE si.document_id = sd.id
    ),
    total_gross_weight_kg = (
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
WHERE sd.deleted_at IS NULL;

-- Step 5: Verify and show results
SELECT 
    'VERIFICATION' as status,
    COUNT(*) as orders_updated,
    SUM(CASE WHEN total_gross_weight_kg > 0 THEN 1 ELSE 0 END) as orders_with_gross_weight
FROM sales_documents
WHERE deleted_at IS NULL;

-- Show latest 5 orders
SELECT 
    document_number,
    total_weight_kg as peso_liquido,
    total_gross_weight_kg as peso_bruto,
    created_at
FROM sales_documents
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
