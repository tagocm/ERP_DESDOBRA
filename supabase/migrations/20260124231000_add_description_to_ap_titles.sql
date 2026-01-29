-- Migration: Add Description to AP Titles
-- Description: Adds a description field for general notes on the payable title (e.g. source explanation).

BEGIN;

ALTER TABLE public.ap_titles 
ADD COLUMN IF NOT EXISTS description TEXT;

COMMIT;
