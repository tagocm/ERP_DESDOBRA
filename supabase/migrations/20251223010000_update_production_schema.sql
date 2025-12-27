-- Migration to update production schema
-- Date: 2025-12-23

-- 1. Add columns to bom_lines
ALTER TABLE public.bom_lines 
ADD COLUMN IF NOT EXISTS loss_percent NUMERIC DEFAULT 0 CHECK (loss_percent >= 0 AND loss_percent <= 100),
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.bom_lines.loss_percent IS 'Expected loss percentage for this component in this BOM';
COMMENT ON COLUMN public.bom_lines.notes IS 'Optional notes for this component line';

-- 2. Add columns to item_production_profiles
ALTER TABLE public.item_production_profiles
ADD COLUMN IF NOT EXISTS production_uom TEXT,
ADD COLUMN IF NOT EXISTS loss_percent NUMERIC DEFAULT 0 CHECK (loss_percent >= 0 AND loss_percent <= 100);

COMMENT ON COLUMN public.item_production_profiles.production_uom IS 'Unit of measure for production (e.g., Batch, Liter, etc)';
COMMENT ON COLUMN public.item_production_profiles.loss_percent IS 'Standard loss percentage for the item production process';
