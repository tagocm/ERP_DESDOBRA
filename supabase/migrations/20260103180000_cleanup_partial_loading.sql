-- Migration: Cleanup Legacy Partial Loading
-- Date: 2026-01-03
-- Description: Removes occurrence reasons related to the deprecated partial loading model.

BEGIN;

-- 1. First remove referencing Occurrences (Cascade manual)
DELETE FROM "delivery_route_order_occurrences"
WHERE "reason_id" IN (
    SELECT "id" FROM "occurrence_reasons" 
    WHERE "occurrence_type" IN ('exp_nao_carregado', 'exp_parcial')
);

-- 2. Remove Occurrence Reasons for types that no longer exist
DELETE FROM "occurrence_reasons"
WHERE "occurrence_type" IN ('exp_nao_carregado', 'exp_parcial');

-- Note: We are NOT dropping columns or tables yet to be conservative, 
-- but we are cleaning up the configuration data so it doesn't appear in queries.

COMMIT;
