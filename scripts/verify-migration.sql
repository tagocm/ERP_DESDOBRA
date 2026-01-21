-- Quick verification queries for the migration
-- Run these to validate the implementation

-- 1. Check triggers are in place
SELECT 
    tgname as trigger_name, 
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname LIKE '%prevent_financial%'
ORDER BY tgname;

-- Expected: 2 rows
-- - trg_prevent_financial_event_installments_delete on financial_event_installments
-- - trg_prevent_financial_events_delete on financial_events

-- 2. Check unique constraint exists
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name
FROM pg_constraint 
WHERE conname = 'unique_event_installment_number';

-- Expected: 1 row
-- - unique_event_installment_number on financial_event_installments

-- 3. Test data integrity (no duplicated events)
SELECT 
    COUNT(*) as total_events, 
    COUNT(DISTINCT (company_id, origin_type, origin_id)) as unique_origins
FROM financial_events;

-- Expected: total_events = unique_origins (no duplicates)

-- 4. Quick function test (optional - will fail, which is expected)
-- DELETE FROM financial_events LIMIT 1;
-- Expected error: "Registros de eventos financeiros não podem ser excluídos"
