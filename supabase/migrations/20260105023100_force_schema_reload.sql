-- Force PostgREST schema reload
-- This resolves the "Could not find a relationship between 'items' and 'item_packaging'" error

NOTIFY pgrst, 'reload schema';
