-- Migration: Fix commission calculation by allocation
-- Prevents base duplication when a payment has multiple allocations
-- Date: 2026-02-06

-- 1. Add ar_payment_allocation_id column
ALTER TABLE commission_lines
ADD COLUMN ar_payment_allocation_id UUID;

-- 2. Add FK constraint to ar_payment_allocations
ALTER TABLE commission_lines
ADD CONSTRAINT fk_commission_lines_allocation
    FOREIGN KEY (ar_payment_allocation_id)
    REFERENCES ar_payment_allocations(id)
    ON DELETE RESTRICT;

-- 3. Rename payment_amount to allocated_amount for clarity
ALTER TABLE commission_lines
RENAME COLUMN payment_amount TO allocated_amount;

-- 4. Drop old unique index (closing_id, ar_payment_id)
DROP INDEX IF EXISTS idx_commission_lines_unique_payment;

-- 5. Create new unique index (closing_id, ar_payment_allocation_id)
-- This ensures idempotency: same allocation cannot be in the same closing twice
CREATE UNIQUE INDEX idx_commission_lines_unique_allocation
    ON commission_lines(closing_id, ar_payment_allocation_id)
    WHERE ar_payment_allocation_id IS NOT NULL;

-- 6. Create index on ar_payment_allocation_id for performance
CREATE INDEX idx_commission_lines_allocation
    ON commission_lines(ar_payment_allocation_id)
    WHERE ar_payment_allocation_id IS NOT NULL;

-- 7. Add comment explaining the change
COMMENT ON COLUMN commission_lines.ar_payment_allocation_id IS 
'FK to ar_payment_allocations. Commission is calculated per allocation to avoid duplicating base when a payment has multiple allocations.';

COMMENT ON COLUMN commission_lines.allocated_amount IS 
'Amount allocated from the payment (ar_payment_allocations.amount_allocated). This is the base for commission calculation.';

-- 8. Update existing data (if any) - mark as NULL since we cannot retroactively determine allocation
-- In production, you might need a more sophisticated migration strategy
UPDATE commission_lines
SET ar_payment_allocation_id = NULL
WHERE ar_payment_allocation_id IS NULL;

-- Note: Existing commission_lines rows will have ar_payment_allocation_id = NULL
-- New rows MUST have ar_payment_allocation_id populated
-- Consider adding NOT NULL constraint after backfilling data if needed
