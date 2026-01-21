-- Migration: Force Schema Cache Reload
-- Date: 2026-01-04
-- Description: Forces PostgREST to reload its schema cache to recognize new columns.

NOTIFY pgrst, 'reload schema';