-- Migration: Expand Order Delivery Event Types
-- Description: Adds more event types to the check constraint for order_delivery_events

ALTER TABLE public.order_delivery_events DROP CONSTRAINT IF EXISTS order_delivery_events_event_type_check;

ALTER TABLE public.order_delivery_events ADD CONSTRAINT order_delivery_events_event_type_check 
    CHECK (event_type IN (
        'CARREGAMENTO_PARCIAL', 
        'NAO_CARREGAMENTO', 
        'ENTREGA_PARCIAL', 
        'NAO_ENTREGA',
        'ENTREGA_SUCESSO',
        'DEVOLUCAO_TOTAL'
    ));

-- Force schema reload
NOTIFY pgrst, 'reload schema';
