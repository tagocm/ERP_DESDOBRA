
DO $$ 
BEGIN
    ALTER TABLE delivery_route_orders DROP CONSTRAINT IF EXISTS delivery_route_orders_loading_status_check;
    
    ALTER TABLE delivery_route_orders 
    ADD CONSTRAINT delivery_route_orders_loading_status_check 
    CHECK (loading_status in ('pending', 'loaded', 'partial', 'not_loaded'));
END $$;
