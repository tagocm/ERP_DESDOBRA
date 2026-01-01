-- Fix: Recalculate gross weight for existing orders
-- FINAL VERSION: Removed deleted_at check from items (column doesn't exist)

-- 1. Adicionar coluna se não existir
ALTER TABLE sales_documents
ADD COLUMN IF NOT EXISTS total_gross_weight_kg NUMERIC(10, 3) DEFAULT 0;

-- 2. Recalcular TODOS os pedidos
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

-- 3. Verificar pedido #64
SELECT 
    document_number,
    total_weight_kg as peso_liquido_kg,
    total_gross_weight_kg as peso_bruto_kg
FROM sales_documents
WHERE document_number = 64;
