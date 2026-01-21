DO $$
BEGIN
    ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'order_delivery_events') = 1, 'order_delivery_events missing';
    ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'delivery_reasons') = 1, 'delivery_reasons missing';
    RAISE NOTICE 'All required tables for new logistics flow exist.';
END $$;
