-- Migration: Ensure route_id in deliveries
-- Description: Adds route_id column to deliveries table if it doesn't exist, and establishes FK.

-- 1. Ensure column exists
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS route_id UUID;

-- 2. Drop existing constraint if found (cleanup)
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_route_id_fkey;

-- 3. Add FK
ALTER TABLE public.deliveries 
    ADD CONSTRAINT deliveries_route_id_fkey 
    FOREIGN KEY (route_id) 
    REFERENCES public.delivery_routes(id) 
    ON DELETE SET NULL;

-- 4. Create Index
CREATE INDEX IF NOT EXISTS idx_deliveries_route_id ON public.deliveries(route_id);

-- Force Schema Reload
NOTIFY pgrst, 'reload schema';
