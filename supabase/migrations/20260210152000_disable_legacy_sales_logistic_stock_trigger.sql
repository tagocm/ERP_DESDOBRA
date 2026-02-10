-- Disable legacy stock trigger on sales_documents.status_logistic.
-- Root cause:
-- 1) Legacy trigger inserts inventory_movements with reference_type='pedido'
-- 2) New logistics flow (deliveries model) already inserts stock deduction via RPC
--    deduct_stock_from_route() with reference_type='delivery_item'
-- This causes duplicate stock deductions when starting a route.

BEGIN;

DROP TRIGGER IF EXISTS trg_sales_order_logistic_change_stock
ON public.sales_documents;

COMMENT ON FUNCTION public.handle_sales_order_logistic_change_stock()
IS 'LEGACY: disabled by migration 20260210152000. Stock deduction is handled by deduct_stock_from_route() in deliveries flow.';

COMMIT;
