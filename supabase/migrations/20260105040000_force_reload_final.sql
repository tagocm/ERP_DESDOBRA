-- Final Schema Reload and Verification
-- Version: 20260105040000

-- Ensure columns exist just in case (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'delivery_route_orders' AND column_name = 'loading_status') THEN
        ALTER TABLE public.delivery_route_orders ADD COLUMN loading_status TEXT DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'delivery_route_orders' AND column_name = 'volumes') THEN
        ALTER TABLE public.delivery_route_orders ADD COLUMN volumes INTEGER DEFAULT 1;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
