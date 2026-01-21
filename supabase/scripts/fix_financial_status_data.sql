-- DATA CORRECTION V2: Fix Enum Errors by Casting
-- Use this to fix orders that appear as 'Pendente' but are actually processed.

BEGIN;

-- 1. Orders already Delivered or Approved -> APROVADO
-- We use ::text to avoid "invalid input value for enum" errors if we check against legacy values.
UPDATE sales_documents
SET financial_status = 'aprovado'
WHERE financial_status = 'pendente' 
  AND (
      status_logistic::text IN ('delivered', 'entregue') 
      OR status_commercial::text IN ('billed', 'paid', 'approved', 'confirmed') 
  );

-- 2. Orders currently in Route -> PRE_LANCADO
UPDATE sales_documents
SET financial_status = 'pre_lancado'
WHERE financial_status = 'pendente'
  AND status_logistic::text = 'em_rota';

-- 3. Orders Cancelled -> CANCELADO
UPDATE sales_documents
SET financial_status = 'cancelado'
WHERE status_commercial::text = 'cancelled' OR status_fiscal::text = 'cancelled';

COMMIT;
