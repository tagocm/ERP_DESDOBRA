-- Remove duplicated stock deductions created by legacy trigger
-- when deliveries flow already recorded deduction by delivery_item.
--
-- Keep only the deliveries-model movement:
--   reference_type = 'delivery_item' / reason = 'sales_delivery'
-- Remove legacy duplicate:
--   reference_type = 'pedido' / reason = 'sale_out'

BEGIN;

WITH legacy_dup AS (
    SELECT DISTINCT legacy.id
    FROM public.inventory_movements legacy
    WHERE legacy.reference_type = 'pedido'
      AND legacy.movement_type = 'SAIDA'
      AND legacy.reason = 'sale_out'
      AND EXISTS (
          SELECT 1
          FROM public.sales_document_items sdi
          JOIN public.delivery_items di
            ON di.sales_document_item_id = sdi.id
          JOIN public.inventory_movements modern
            ON modern.reference_type = 'delivery_item'
           AND modern.reference_id = di.id
           AND modern.movement_type = 'SAIDA'
           AND modern.reason = 'sales_delivery'
           AND modern.company_id = legacy.company_id
           AND modern.item_id = legacy.item_id
          WHERE sdi.document_id = legacy.reference_id
      )
)
DELETE FROM public.inventory_movements im
USING legacy_dup d
WHERE im.id = d.id;

COMMIT;
