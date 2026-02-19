-- Add due_date to fleet_traffic_fines
ALTER TABLE fleet_traffic_fines ADD COLUMN IF NOT EXISTS due_date DATE;
