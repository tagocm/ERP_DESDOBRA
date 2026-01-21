-- Migration: Add RLS policies for deliveries and delivery_items
-- Date: 2026-01-05

-- Enable RLS just in case (it likely is, but good practice)
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;

-- Policy for deliveries: Authenticated users can read all (assuming basic access, refine if multi-tenant strictness needed)
-- Drop existing if any (none found by grep)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON deliveries;

CREATE POLICY "Enable read access for authenticated users"
ON deliveries
FOR SELECT
TO authenticated
USING (true);

-- Policy for delivery_items
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON delivery_items;

CREATE POLICY "Enable read access for authenticated users"
ON delivery_items
FOR SELECT
TO authenticated
USING (true);
