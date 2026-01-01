-- CORRECT APPROACH: Snapshot-based weight calculation
-- Weight is calculated ONCE when item is added/updated, not dynamically from product

-- Step 1: Drop existing triggers
DROP TRIGGER IF EXISTS trigger_update_gross_weight ON sales_document_items;
DROP TRIGGER IF EXISTS trigger_update_weights ON sales_document_items;
DROP TRIGGER IF EXISTS update_sales_order_total_weight_delta ON sales_document_items;

-- Step 2: Add snapshot column to sales_document_items if not exists
ALTER TABLE sales_document_items
ADD COLUMN IF NOT EXISTS gross_weight_kg_snapshot NUMERIC(15, 6);

COMMENT ON COLUMN sales_document_items.gross_weight_kg_snapshot IS 'Snapshot do peso bruto unitário no momento da adição do item (kg)';

-- Step 3: Create function to snapshot weight when item is added/updated
CREATE OR REPLACE FUNCTION snapshot_item_gross_weight()
RETURNS TRIGGER AS $$
DECLARE
    v_product RECORD;
BEGIN
    -- Only snapshot if item_id changed or quantity changed
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.item_id IS DISTINCT FROM NEW.item_id)) THEN
        
        -- Get product weight info
        SELECT 
            gross_weight_g_base,
            net_weight_g_base
        INTO v_product
        FROM items
        WHERE id = NEW.item_id;
        
        -- Snapshot gross weight (prefer gross, fallback to net * 1.1)
        IF v_product.gross_weight_g_base IS NOT NULL THEN
            NEW.gross_weight_kg_snapshot := v_product.gross_weight_g_base / 1000.0;
        ELSIF v_product.net_weight_g_base IS NOT NULL THEN
            NEW.gross_weight_kg_snapshot := (v_product.net_weight_g_base / 1000.0) * 1.1;
        ELSIF NEW.total_weight_kg IS NOT NULL THEN
            NEW.gross_weight_kg_snapshot := NEW.total_weight_kg * 1.1;
        ELSE
            NEW.gross_weight_kg_snapshot := NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create BEFORE trigger to snapshot weight
CREATE TRIGGER trigger_snapshot_item_gross_weight
BEFORE INSERT OR UPDATE ON sales_document_items
FOR EACH ROW
EXECUTE FUNCTION snapshot_item_gross_weight();

-- Step 5: Create function to update order totals (using snapshots)
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

    UPDATE sales_documents
    SET 
        -- Net weight: sum of item total_weight_kg
        total_weight_kg = (
            SELECT COALESCE(SUM(COALESCE(si.total_weight_kg, 0)), 0)
            FROM sales_document_items si
            WHERE si.document_id = v_document_id
        ),
        -- Gross weight: sum of SNAPSHOT weights (not dynamic from product!)
        total_gross_weight_kg = (
            SELECT COALESCE(SUM(
                COALESCE(si.gross_weight_kg_snapshot, 0) * COALESCE(si.quantity, 0)
            ), 0)
            FROM sales_document_items si
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

-- Step 6: Create AFTER trigger to update order totals
CREATE TRIGGER trigger_update_order_weights
AFTER INSERT OR UPDATE OR DELETE ON sales_document_items
FOR EACH ROW
EXECUTE FUNCTION update_sales_document_weights();

-- Step 7: Populate snapshots for existing items
UPDATE sales_document_items si
SET gross_weight_kg_snapshot = (
    SELECT 
        CASE 
            WHEN i.gross_weight_g_base IS NOT NULL THEN i.gross_weight_g_base / 1000.0
            WHEN i.net_weight_g_base IS NOT NULL THEN (i.net_weight_g_base / 1000.0) * 1.1
            WHEN si.total_weight_kg IS NOT NULL THEN si.total_weight_kg * 1.1
            ELSE NULL
        END
    FROM items i
    WHERE i.id = si.item_id
)
WHERE gross_weight_kg_snapshot IS NULL;

-- Step 8: Recalculate order totals using snapshots
UPDATE sales_documents sd
SET 
    total_weight_kg = (
        SELECT COALESCE(SUM(COALESCE(si.total_weight_kg, 0)), 0)
        FROM sales_document_items si
        WHERE si.document_id = sd.id
    ),
    total_gross_weight_kg = (
        SELECT COALESCE(SUM(
            COALESCE(si.gross_weight_kg_snapshot, 0) * COALESCE(si.quantity, 0)
        ), 0)
        FROM sales_document_items si
        WHERE si.document_id = sd.id
    )
WHERE sd.deleted_at IS NULL;

-- Step 9: Verify
SELECT 
    'VERIFICATION' as status,
    COUNT(*) as total_orders,
    SUM(CASE WHEN total_gross_weight_kg > 0 THEN 1 ELSE 0 END) as orders_with_gross_weight
FROM sales_documents
WHERE deleted_at IS NULL;

-- Show latest orders
SELECT 
    document_number,
    total_weight_kg as peso_liquido,
    total_gross_weight_kg as peso_bruto,
    created_at
FROM sales_documents
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
