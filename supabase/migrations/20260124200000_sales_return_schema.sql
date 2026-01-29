-- Migration: Sales Return Schema Support
-- Description: Enables 'RETURN' types in financial and logisitic events.

BEGIN;

-- 1. Update Financial Events Origin Type
--    We need to drop the old check and add a new one including 'RETURN'
DO $$
BEGIN
    -- Drop old constraint if exists (name might vary, try standard name)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_events_origin_type_check') THEN
        ALTER TABLE public.financial_events DROP CONSTRAINT financial_events_origin_type_check;
    END IF;

    -- Add new constraint
    ALTER TABLE public.financial_events 
    ADD CONSTRAINT financial_events_origin_type_check 
    CHECK (origin_type IN ('SALE', 'PURCHASE', 'EXPENSE', 'MANUAL', 'RETURN'));
END $$;

-- 2. Update Delivery Reasons (If table exists and has check)
--    We want to ensure 'DEVOLUCAO' is a valid reason group
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'delivery_reasons') THEN
        -- Check if there is a constraint on reason_group
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_reasons_reason_group_check') THEN
             ALTER TABLE public.delivery_reasons DROP CONSTRAINT delivery_reasons_reason_group_check;
             
             -- Sanitize existing data
             UPDATE public.delivery_reasons 
             SET reason_group = 'OUTROS' 
             WHERE reason_group NOT IN ('NAO_ENTREGUE', 'REENVIO', 'CANCELAMENTO', 'DEVOLUCAO', 'OUTROS');
             
             ALTER TABLE public.delivery_reasons 
             ADD CONSTRAINT delivery_reasons_reason_group_check 
             CHECK (reason_group IN ('NAO_ENTREGUE', 'REENVIO', 'CANCELAMENTO', 'DEVOLUCAO', 'OUTROS'));
        END IF;
        
        -- Insert default reason for Return for EACH company if not exists
        INSERT INTO public.delivery_reasons (company_id, name, reason_group)
        SELECT c.id, 'Devolução de Mercadoria', 'DEVOLUCAO'
        FROM public.companies c
        WHERE NOT EXISTS (
            SELECT 1 FROM public.delivery_reasons dr 
            WHERE dr.company_id = c.id AND dr.reason_group = 'DEVOLUCAO'
        );
        
    END IF;
END $$;

-- 3. Update Order Delivery Events (Check Constraint for event_type)
DO $$
BEGIN
    -- It might be just text, but if there's a check, update it.
    -- Commonly we don't put strict checks on event logs, but if we did:
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_delivery_events_event_type_check') THEN
        ALTER TABLE public.order_delivery_events DROP CONSTRAINT order_delivery_events_event_type_check;
        -- Constraint removed to allow new event types without strict enum maintenance
    END IF;
END $$;

COMMIT;
