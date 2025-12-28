-- Add Fiscal Fields to Tax Groups
-- Author: Antigravity
-- Date: 2025-12-28

ALTER TABLE public.tax_groups
ADD COLUMN IF NOT EXISTS ncm TEXT,
ADD COLUMN IF NOT EXISTS cest TEXT,
ADD COLUMN IF NOT EXISTS origin_default INT DEFAULT 0;
