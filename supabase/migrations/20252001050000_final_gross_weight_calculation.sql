-- FINAL MIGRATION: Gross Weight Calculation (CORRECTED)
-- This is the definitive version with proper CASE logic

-- Step 1: Ensure column exists
ALTER TABLE sales_documents
ADD COLUMN IF NOT EXISTS total_gross_weight_kg NUMERIC(10, 3) DEFAULT 0;

COMMENT ON COLUMN sales_documents.total_gross_weight_kg IS 'Peso bruto total em kg (calculado a partir do gross_weight_g_base dos produtos)';

-- Step 2: Drop all existing weight triggers
DROP TRIGGER IF EXISTS trigger_update_gross_weight ON sales_document_items;
DROP TRIGGER IF EXISTS trigger_update_order_weights ON sales_document_items;
DROP TRIGGER IF EXISTS trigger_update_weights ON sales_document_items;
DROP TRIGGER IF EXISTS update_sales_order_total_weight_delta ON sales_document_items;

-- Step 3: Create the CORRECT calculation function
CREATE OR REPLACE FUNCTION update_sales_document_weights()
RETURNS TRIGGER AS $$
DECLARE
    v_document_id UUID;
BEGIN
    -- Get document_id from appropriate record
    IF TG_OP = 'DELETE' THEN
        v_document_id := OLD.document_id;
    ELSE
        v_document_id := NEW.document_id;
    END IF;

    -- Update both net and gross weights
    UPDATE sales_documents
    SET 
        -- Net weight: sum of item weights
        total_weight_kg = (
            SELECT COALESCE(SUM(COALESCE(si.total_weight_kg, 0)), 0)
            FROM sales_document_items si
            WHERE si.document_id = v_document_id
        ),
        -- Gross weight: use product's gross_weight_g_base if available
        total_gross_weight_kg = (
            SELECT COALESCE(SUM(
                CASE 
                    -- If product has gross weight defined and > 0, use it
                    WHEN i.gross_weight_g_base IS NOT NULL AND i.gross_weight_g_base > 0
                    THEN (i.gross_weight_g_base / 1000.0) * COALESCE(si.quantity, 0)
                    -- Otherwise, estimate as net weight + 10%
                    ELSE COALESCE(si.total_weight_kg, 0) * 1.1
                END
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

-- Step 4: Create trigger
CREATE TRIGGER trigger_update_gross_weight
AFTER INSERT OR UPDATE OR DELETE ON sales_document_items
FOR EACH ROW
EXECUTE FUNCTION update_sales_document_weights();

-- Step 5: Recalculate all existing orders
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

-- Step 6: Verification
DO $$
DECLARE
    v_trigger_count INTEGER;
    v_orders_updated INTEGER;
    v_orders_with_gross INTEGER;
BEGIN
    -- Check trigger exists
    SELECT COUNT(*) INTO v_trigger_count
    FROM information_schema.triggers
    WHERE trigger_name = 'trigger_update_gross_weight'
    AND event_object_table = 'sales_document_items';
    
    -- Count orders
    SELECT 
        COUNT(*),
        SUM(CASE WHEN total_gross_weight_kg > 0 THEN 1 ELSE 0 END)
    INTO v_orders_updated, v_orders_with_gross
    FROM sales_documents
    WHERE deleted_at IS NULL;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ GROSS WEIGHT CALCULATION INSTALLED';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Trigger installed: %', CASE WHEN v_trigger_count > 0 THEN 'YES ✅' ELSE 'NO ❌' END;
    RAISE NOTICE 'Orders processed: %', v_orders_updated;
    RAISE NOTICE 'Orders with gross weight: %', v_orders_with_gross;
    RAISE NOTICE '========================================';
END $$;
