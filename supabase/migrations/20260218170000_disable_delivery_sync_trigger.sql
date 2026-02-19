-- Migration: Temporarily Drop Delivery Sync Trigger
-- Description: Drops trg_deliveries_sync_status to verify if it is the source of the 500 error.

BEGIN;

DROP TRIGGER IF EXISTS trg_deliveries_sync_status ON public.deliveries;
DROP FUNCTION IF EXISTS public.trigger_sync_logistic_status();

COMMIT;
