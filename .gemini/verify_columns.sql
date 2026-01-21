-- Script to verify existing columns
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_name IN ('delivery_route_orders', 'delivery_routes', 'sales_documents')
AND column_name IN ('volumes', 'loading_status', 'scheduled_date', 'loading_checked')
ORDER BY table_name, column_name;
