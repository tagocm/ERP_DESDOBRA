-- Migration: Fix loading_status constraint to match logistics_status enum (PT-BR)
-- Description: Updates Check constraint on delivery_route_orders to allow 'pendente' instead of 'pending'.

BEGIN;

-- 1. Update Check Constraint
ALTER TABLE delivery_route_orders DROP CONSTRAINT IF EXISTS delivery_route_orders_loading_status_check;

ALTER TABLE delivery_route_orders 
    ADD CONSTRAINT delivery_route_orders_loading_status_check 
    CHECK (loading_status IN ('pending', 'pendente', 'loaded', 'partial', 'not_loaded', 'entregue', 'nao_entregue', 'devolvido'));
    -- Allowing mixed values for safety during transition

-- 2. Update existing 'pending' to 'pendente' if needed, or leave as alias?
-- Let's stick to 'pendente' going forward.

COMMIT;
