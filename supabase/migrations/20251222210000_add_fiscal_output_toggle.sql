-- Migration: Add has_fiscal_output to item_fiscal_profiles
-- Reason: To control visibility of fiscal fields in UI and logic

ALTER TABLE public.item_fiscal_profiles
ADD COLUMN IF NOT EXISTS has_fiscal_output BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.item_fiscal_profiles.has_fiscal_output IS 'Toggle to enable/disable fiscal output fields for the item';
