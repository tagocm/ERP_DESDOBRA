-- Add ON_HOLD and PARTIAL to ar_titles status check constraint
ALTER TABLE public.ar_titles DROP CONSTRAINT IF EXISTS ar_titles_status_check;

ALTER TABLE public.ar_titles
    ADD CONSTRAINT ar_titles_status_check 
    CHECK (status IN ('PENDING_APPROVAL', 'OPEN', 'PARTIAL', 'PAID', 'CANCELLED', 'ON_HOLD'));
