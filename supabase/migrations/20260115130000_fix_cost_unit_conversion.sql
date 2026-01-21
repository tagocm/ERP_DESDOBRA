-- Fix: Update Cost on Purchase Received - Correct Unit Conversion
-- Date: 2026-01-15
-- Description: Fixes the trigger to correctly convert unit_cost to base UOM

-- Drop old trigger and function
DROP TRIGGER IF EXISTS purchase_order_cost_update ON purchase_orders;
DROP FUNCTION IF EXISTS update_cost_on_purchase_received();

-- Recreate with correct conversion
CREATE OR REPLACE FUNCTION update_cost_on_purchase_received()
RETURNS TRIGGER AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- Only when status changes to 'received'
    IF NEW.status = 'received' AND (OLD.status IS NULL OR OLD.status != 'received') THEN
        -- Update cost for each item in the purchase order
        FOR v_item IN
            SELECT 
                item_id, 
                unit_cost,
                conversion_factor
            FROM purchase_order_items
            WHERE purchase_order_id = NEW.id
              AND unit_cost > 0
              AND conversion_factor > 0
        LOOP
            -- CRITICAL: Convert unit_cost to base UOM
            -- Example: R$ 105/Saco ÷ 25kg/Saco = R$ 4.20/kg
            PERFORM update_item_cost(
                v_item.item_id, 
                v_item.unit_cost / v_item.conversion_factor
            );
            
            -- Recalculate dependent finished goods
            PERFORM recalculate_dependent_costs(v_item.item_id);
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_order_cost_update
    AFTER UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_cost_on_purchase_received();

COMMENT ON TRIGGER purchase_order_cost_update ON purchase_orders IS 'Updates item costs when a purchase order is marked as received (with correct unit conversion)';
