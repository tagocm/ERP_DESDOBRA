-- Migration: Delivery and Weight Enhancements
-- Add scheduled delivery date, delivered timestamp, and gross weight tracking

-- Add new columns to sales_documents
ALTER TABLE sales_documents
ADD COLUMN IF NOT EXISTS scheduled_delivery_date DATE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_gross_weight_kg NUMERIC(10, 3) DEFAULT 0;

-- Add comments
COMMENT ON COLUMN sales_documents.scheduled_delivery_date IS 'Data prevista de entrega (definida pela rota)';
COMMENT ON COLUMN sales_documents.delivered_at IS 'Data/hora real da entrega (confirmada no retorno)';
COMMENT ON COLUMN sales_documents.total_gross_weight_kg IS 'Peso bruto total do pedido em kg (calculado automaticamente)';

-- Update the weight calculation trigger to include gross weight
-- This assumes items have a gross_weight_g field or we calculate from net weight
CREATE OR REPLACE FUNCTION update_sales_document_weights()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate total net weight (existing logic)
    UPDATE sales_documents
    SET total_weight_kg = (
        SELECT COALESCE(SUM(
            COALESCE(si.total_weight_kg, 0)
        ), 0)
        FROM sales_document_items si
        WHERE si.document_id = NEW.document_id
    ),
    -- Calculate total gross weight (new logic)
    total_gross_weight_kg = (
        SELECT COALESCE(SUM(
            COALESCE(
                (i.gross_weight_g_base / 1000.0), -- Convert grams to kg
                COALESCE(si.total_weight_kg, 0) * 1.1  -- Fallback: assume 10% packaging if no gross weight
            ) * COALESCE(si.quantity, 0)
        ), 0)
        FROM sales_document_items si
        LEFT JOIN items i ON i.id = si.item_id
        WHERE si.document_id = NEW.document_id
    )
    WHERE id = NEW.document_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_weights ON sales_document_items;
CREATE TRIGGER trigger_update_weights
AFTER INSERT OR UPDATE OR DELETE ON sales_document_items
FOR EACH ROW
EXECUTE FUNCTION update_sales_document_weights();
