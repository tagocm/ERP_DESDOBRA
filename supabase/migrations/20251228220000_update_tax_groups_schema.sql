-- Update Tax Groups Schema with Status and Observation
-- Author: Antigravity
-- Date: 2025-12-28

ALTER TABLE public.tax_groups
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS observation TEXT;

-- Index for filtering active groups
CREATE INDEX IF NOT EXISTS idx_tax_groups_active ON public.tax_groups(is_active);
