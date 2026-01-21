-- Ensure 'created_by' and 'updated_at' columns exist in deliveries
-- and force schema reload

BEGIN;

-- 1. Check and Add Columns
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Check and Add Columns for delivery_items just in case
ALTER TABLE public.delivery_items ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.delivery_items ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Force Schema Reload
NOTIFY pgrst, 'reload schema';

COMMIT;
