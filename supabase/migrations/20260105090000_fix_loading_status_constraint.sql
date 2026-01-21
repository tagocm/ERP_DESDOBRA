-- Migration: Fix loading_status check constraint
-- Description: Updates the check constraint to allow 'pendente' which is used by the frontend

ALTER TABLE public.delivery_route_orders DROP CONSTRAINT IF EXISTS delivery_route_orders_loading_status_check;

ALTER TABLE public.delivery_route_orders ADD CONSTRAINT delivery_route_orders_loading_status_check 
    CHECK (loading_status IN ('pending', 'pendente', 'loaded', 'partial', 'not_loaded', 'carregado', 'parcial', 'nao_carregado'));

-- Standardize existing 'pending' to 'pendente' if that's what the app expects
UPDATE public.delivery_route_orders SET loading_status = 'pendente' WHERE loading_status = 'pending';

-- Update default value for the column if needed
ALTER TABLE public.delivery_route_orders ALTER COLUMN loading_status SET DEFAULT 'pendente';

NOTIFY pgrst, 'reload schema';
