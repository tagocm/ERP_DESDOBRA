-- Migration: List Triggers Diagnostic (Part 2)
-- Description: Raises notices containing the names of triggers on delivery_items.

DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== DIAGNOSTIC: TRIGGERS ON delivery_items ===';
    FOR r IN 
        SELECT trigger_name, action_timing, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'delivery_items'
    LOOP
        RAISE NOTICE 'Trigger: % (% %)', r.trigger_name, r.action_timing, r.event_manipulation;
    END LOOP;
END $$;
