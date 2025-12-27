-- Migration: Ensure instagram column exists in company_settings
-- Created: 2025-12-27
-- Description: Adds instagram column if it doesn't exist

ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS instagram TEXT;

COMMENT ON COLUMN public.company_settings.instagram IS 'Instagram handle da empresa';
