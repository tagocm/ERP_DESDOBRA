-- Normalize legacy status_logistic='expedition' to the active logistics flow.
-- Safe/idempotent:
-- - Only touches rows still marked as legacy "expedition".
-- - Chooses target status based on route/delivery evidence.
-- - Does not alter rows already in current statuses.

BEGIN;

WITH legacy_expedition AS (
    SELECT
        sd.id,
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM public.deliveries d
                WHERE d.sales_document_id = sd.id
                  AND d.status = 'in_route'
            ) THEN 'in_route'
            WHEN EXISTS (
                SELECT 1
                FROM public.deliveries d
                WHERE d.sales_document_id = sd.id
                  AND d.status = 'delivered'
            ) AND EXISTS (
                SELECT 1
                FROM public.deliveries d
                WHERE d.sales_document_id = sd.id
                  AND d.status IN ('returned_partial', 'returned_total')
            ) THEN 'partial'
            WHEN EXISTS (
                SELECT 1
                FROM public.deliveries d
                WHERE d.sales_document_id = sd.id
                  AND d.status = 'delivered'
            ) THEN 'delivered'
            WHEN EXISTS (
                SELECT 1
                FROM public.deliveries d
                WHERE d.sales_document_id = sd.id
                  AND d.status IN ('returned_partial', 'returned_total')
            ) THEN 'returned'
            WHEN EXISTS (
                SELECT 1
                FROM public.delivery_route_orders dro
                WHERE dro.sales_document_id = sd.id
            ) THEN 'routed'
            ELSE 'pending'
        END AS target_status
    FROM public.sales_documents sd
    WHERE sd.status_logistic::text = 'expedition'
)
UPDATE public.sales_documents sd
SET status_logistic = legacy_expedition.target_status::public.sales_logistic_status_en,
    updated_at = NOW()
FROM legacy_expedition
WHERE sd.id = legacy_expedition.id
  AND sd.status_logistic::text <> legacy_expedition.target_status;

NOTIFY pgrst, 'reload';

COMMIT;
