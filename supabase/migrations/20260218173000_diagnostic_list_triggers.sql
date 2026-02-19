-- Migration: List Triggers Diagnostic
-- Description: Raises notices containing the names of all triggers on sales_documents and deliveries.
-- This helps verify which triggers are actually active in the database.

DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== DIAGNOSTIC: TRIGGERS ON sales_documents ===';
    FOR r IN 
        SELECT trigger_name, action_timing, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'sales_documents'
    LOOP
        RAISE NOTICE 'Trigger: % (% %)', r.trigger_name, r.action_timing, r.event_manipulation;
    END LOOP;

    RAISE NOTICE '=== DIAGNOSTIC: TRIGGERS ON deliveries ===';
    FOR r IN 
        SELECT trigger_name, action_timing, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'deliveries'
    LOOP
        RAISE NOTICE 'Trigger: % (% %)', r.trigger_name, r.action_timing, r.event_manipulation;
    END LOOP;

    RAISE NOTICE '=== DIAGNOSTIC: TRIGGERS ON delivery_route_orders ===';
    FOR r IN 
        SELECT trigger_name, action_timing, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'delivery_route_orders'
    LOOP
        RAISE NOTICE 'Trigger: % (% %)', r.trigger_name, r.action_timing, r.event_manipulation;
    END LOOP;
END $$;
