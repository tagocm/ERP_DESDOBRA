-- Add scheduled_date to work_orders
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS scheduled_date date DEFAULT NULL;

-- Add route_id to work_orders
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES delivery_routes(id) DEFAULT NULL;

-- Create indexes for performance on the new columns
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_date ON work_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_route_id ON work_orders(route_id);

-- Optional: Add comment
COMMENT ON COLUMN work_orders.scheduled_date IS 'Data planejada de produção/entrega para o PCP';
COMMENT ON COLUMN work_orders.route_id IS 'Vínculo com a rota de entrega (para rastreabilidade e agrupamento)';
