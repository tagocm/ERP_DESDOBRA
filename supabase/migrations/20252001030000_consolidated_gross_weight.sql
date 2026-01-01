-- CONSOLIDATED MIGRATION: Add gross weight calculation
-- Run this migration to enable automatic gross weight calculation

-- Step 1: Add column if not exists
ALTER TABLE sales_documents
ADD COLUMN IF NOT EXISTS total_gross_weight_kg NUMERIC(10, 3) DEFAULT 0;

COMMENT ON COLUMN sales_documents.total_gross_weight_kg IS 'Peso bruto total do pedido em kg (calculado automaticamente)';

-- Step 2: Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_update_weights ON sales_document_items;
DROP TRIGGER IF EXISTS trigger_update_gross_weight ON sales_document_items;

-- Step 3: Create or replace the weight calculation function
CREATE OR REPLACE FUNCTION update_sales_document_weights()
RETURNS TRIGGER AS $$
DECLARE
    v_document_id UUID;
BEGIN
    -- Determine which document_id to update
    IF TG_OP = 'DELETE' THEN
        v_document_id := OLD.document_id;
    ELSE
        v_document_id := NEW.document_id;
    END IF;

    -- Update both net and gross weights
    UPDATE sales_documents
    SET 
        -- Net weight (sum of item weights)
        total_weight_kg = (
            SELECT COALESCE(SUM(COALESCE(si.total_weight_kg, 0)), 0)
            FROM sales_document_items si
            WHERE si.document_id = v_document_id
        ),
        -- Gross weight (from product gross_weight_g_base or fallback to net * 1.1)
        total_gross_weight_kg = (
            SELECT COALESCE(SUM(
                COALESCE(
                    (i.gross_weight_g_base / 1000.0),
                    COALESCE(si.total_weight_kg, 0) * 1.1
                ) * COALESCE(si.quantity, 0)
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

-- Step 4: Create trigger
CREATE TRIGGER trigger_update_gross_weight
AFTER INSERT OR UPDATE OR DELETE ON sales_document_items
FOR EACH ROW
EXECUTE FUNCTION update_sales_document_weights();

-- Step 5: Recalculate all existing orders
UPDATE sales_documents sd
SET total_gross_weight_kg = (
    SELECT COALESCE(SUM(
        COALESCE(
            (i.gross_weight_g_base / 1000.0),
            COALESCE(si.total_weight_kg, 0) * 1.1
        ) * COALESCE(si.quantity, 0)
    ), 0)
    FROM sales_document_items si
    LEFT JOIN items i ON i.id = si.item_id
    WHERE si.document_id = sd.id
)
WHERE sd.deleted_at IS NULL;

-- Step 6: Verify installation
DO $$
DECLARE
    v_trigger_count INTEGER;
    v_column_exists BOOLEAN;
BEGIN
    -- Check trigger
    SELECT COUNT(*) INTO v_trigger_count
    FROM information_schema.triggers
    WHERE trigger_name = 'trigger_update_gross_weight'
    AND event_object_table = 'sales_document_items';
    
    -- Check column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales_documents'
        AND column_name = 'total_gross_weight_kg'
    ) INTO v_column_exists;
    
    IF v_trigger_count > 0 AND v_column_exists THEN
        RAISE NOTICE '✅ Gross weight calculation installed successfully!';
        RAISE NOTICE 'Trigger: trigger_update_gross_weight';
        RAISE NOTICE 'Column: sales_documents.total_gross_weight_kg';
    ELSE
        RAISE WARNING '⚠️ Installation incomplete. Trigger count: %, Column exists: %', v_trigger_count, v_column_exists;
    END IF;
END $$;
