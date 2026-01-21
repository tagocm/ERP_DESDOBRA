DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_route_order_occurrences') THEN
        RAISE NOTICE 'Table delivery_route_order_occurrences EXISTS';
    ELSE
        RAISE NOTICE 'Table delivery_route_order_occurrences DOES NOT EXIST';
    END IF;
END $$;
