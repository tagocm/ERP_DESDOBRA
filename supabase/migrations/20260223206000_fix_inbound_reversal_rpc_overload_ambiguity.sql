-- Fix: PostgREST RPC becomes ambiguous when there are multiple overloads with the same named parameters.
-- Keep only the canonical function signature (uuid, uuid, jsonb, uuid) used by the backend.

BEGIN;

DROP FUNCTION IF EXISTS public.create_inbound_reversal_request(uuid, uuid, uuid, jsonb);

-- Ask PostgREST to refresh its schema cache after dropping overload.
NOTIFY pgrst, 'reload schema';

COMMIT;

