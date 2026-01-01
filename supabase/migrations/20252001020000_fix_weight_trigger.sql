-- Migration: Fix weight calculation trigger to handle DELETE properly
-- The previous trigger had issues with DELETE operations

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_update_weights ON sales_document_items;

-- Create improved function that handles INSERT, UPDATE, and DELETE
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
        total_weight_kg = (
            SELECT COALESCE(SUM(
                COALESCE(si.total_weight_kg, 0)
            ), 0)
            FROM sales_document_items si
            WHERE si.document_id = v_document_id
        ),
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

-- Create trigger
CREATE TRIGGER trigger_update_weights
AFTER INSERT OR UPDATE OR DELETE ON sales_document_items
FOR EACH ROW
EXECUTE FUNCTION update_sales_document_weights();

-- Recalculate all existing orders
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
WHERE sd.deleted_at IS NULL
AND sd.total_gross_weight_kg IS NOT NULL; -- Only update if column exists
