-- check column
DO $$
DECLARE
    col_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_route_orders' 
        AND column_name = 'loading_status'
    ) INTO col_exists;
    
    IF col_exists THEN
        RAISE NOTICE 'SUCCESS: loading_status exists';
    ELSE
        RAISE EXCEPTION 'FAILURE: loading_status DOES NOT exist';
        -- If it doesn't exist, I'll add it here
        ALTER TABLE public.delivery_route_orders ADD COLUMN loading_status TEXT DEFAULT 'pending';
    END IF;
END $$;
