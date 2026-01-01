-- Add staging columns for return process
ALTER TABLE delivery_route_orders
ADD COLUMN return_outcome_type TEXT CHECK (return_outcome_type IN ('delivered', 'partial', 'not_delivered')),
ADD COLUMN return_payload JSONB,
ADD COLUMN return_updated_at TIMESTAMPTZ;
