-- Migration: Add expedition status fields to delivery_route_orders
-- Description: Adds loading_status and partial_payload to track loading progress per order in a route.

DO $$
BEGIN
    -- Add volumes if not exists (it should exist based on codebase usage, but for safety)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_route_orders' AND column_name = 'volumes') THEN
        ALTER TABLE delivery_route_orders ADD COLUMN volumes INTEGER DEFAULT 1;
    END IF;

    -- Add loading_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_route_orders' AND column_name = 'loading_status') THEN
        ALTER TABLE delivery_route_orders ADD COLUMN loading_status TEXT DEFAULT 'pending';
        ALTER TABLE delivery_route_orders ADD CONSTRAINT delivery_route_orders_loading_status_check CHECK (loading_status IN ('pending', 'loaded', 'partial', 'not_loaded'));
    ELSE
        -- If it exists, we might need to update the check constraint to include 'not_loaded'
        ALTER TABLE delivery_route_orders DROP CONSTRAINT IF EXISTS delivery_route_orders_loading_status_check;
        ALTER TABLE delivery_route_orders ADD CONSTRAINT delivery_route_orders_loading_status_check CHECK (loading_status IN ('pending', 'loaded', 'partial', 'not_loaded'));
    END IF;

    -- Add partial_payload
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_route_orders' AND column_name = 'partial_payload') THEN
        ALTER TABLE delivery_route_orders ADD COLUMN partial_payload JSONB DEFAULT NULL;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dro_loading_status ON delivery_route_orders(loading_status);
