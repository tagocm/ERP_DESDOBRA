-- Temporary: Disable RLS on price_table_items to test
-- This will allow us to confirm the issue is RLS-related

ALTER TABLE public.price_table_items DISABLE ROW LEVEL SECURITY;
