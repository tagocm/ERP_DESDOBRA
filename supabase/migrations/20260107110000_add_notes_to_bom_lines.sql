-- Add notes column to bom_lines as expected by the UI
ALTER TABLE public.bom_lines 
ADD COLUMN IF NOT EXISTS notes TEXT;
