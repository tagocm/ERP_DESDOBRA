-- Migration: Refine Order Delivery Events
-- Description: Adds route_id for context and ensure constraints for upsert compatibility if needed.

DO $$
BEGIN
    -- Add route_id if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'order_delivery_events' AND column_name = 'route_id') THEN
        ALTER TABLE public.order_delivery_events ADD COLUMN route_id UUID REFERENCES public.delivery_routes(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create Index for performance
CREATE INDEX IF NOT EXISTS idx_order_delivery_events_route ON public.order_delivery_events(route_id);

-- Optional: Unique constraint to prevent duplicate "same event type" for same order in same route?
-- If we want one "status" entry per order/route.
-- ALTER TABLE public.order_delivery_events ADD CONSTRAINT unique_order_route_event UNIQUE (order_id, route_id, event_type);
-- But a log is usually multi-entry. For now let's just use insert in API or handle conflict by ID if we have it.

-- Force schema reload
NOTIFY pgrst, 'reload schema';
