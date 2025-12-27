-- Migration: Add scheduled_date to delivery_routes
-- Description: Adds nullable scheduled_date column to differentiate scheduled vs unscheduled routes

-- 1. Add scheduled_date column
ALTER TABLE delivery_routes
ADD COLUMN IF NOT EXISTS scheduled_date date;

-- 2. Add index for efficient calendar queries
CREATE INDEX IF NOT EXISTS idx_delivery_routes_scheduled 
ON delivery_routes(company_id, scheduled_date) 
WHERE scheduled_date IS NOT NULL;

-- 3. Add comment for documentation
COMMENT ON COLUMN delivery_routes.scheduled_date IS 'When set, route appears in calendar view. When NULL, route appears in unscheduled dashboard.';
