-- Migration: Add processing columns to order_delivery_events
-- Description: Adds columns needed for the processing transition (Partial Loading, Returns, etc)

ALTER TABLE public.order_delivery_events 
    ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS processing_result JSONB DEFAULT '{}';

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_order_events_unprocessed ON public.order_delivery_events(processed_at) WHERE processed_at IS NULL;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
