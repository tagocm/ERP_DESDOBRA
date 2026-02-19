-- Migration: Drop Legacy Route Sync Trigger
-- Description: Drops route_status_sync_trigger which causes type errors (text vs enum) and conflicts with API logic.

BEGIN;

-- 1. Drop the trigger on delivery_routes
DROP TRIGGER IF EXISTS route_status_sync_trigger ON public.delivery_routes;

-- 2. Drop the function
DROP FUNCTION IF EXISTS public.sync_route_status_to_orders();

COMMIT;
