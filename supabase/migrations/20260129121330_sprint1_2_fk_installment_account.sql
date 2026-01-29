-- Sprint 1, Step 1.2: Add FK for financial_event_installments.financial_account_id
-- Goal: Ensure all installments reference valid bank accounts
-- Risk: Low - using ON DELETE SET NULL for soft failure  
-- Estimated Time: 15min

BEGIN;

-- Pre-check: Find any orphaned records
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM financial_event_installments
  WHERE financial_account_id IS NOT NULL
    AND financial_account_id NOT IN (SELECT id FROM company_bank_accounts);
  
  RAISE NOTICE 'Found % orphaned financial_account_id records', orphan_count;
  
  -- Clean orphaned records by setting to NULL
  IF orphan_count > 0 THEN
    UPDATE financial_event_installments
    SET financial_account_id = NULL
    WHERE financial_account_id IS NOT NULL
      AND financial_account_id NOT IN (SELECT id FROM company_bank_accounts);
    
    RAISE NOTICE 'Cleaned % orphaned records', orphan_count;
  END IF;
END $$;

-- Add foreign key constraint
ALTER TABLE financial_event_installments
ADD CONSTRAINT fk_installment_account
FOREIGN KEY (financial_account_id) 
REFERENCES company_bank_accounts(id) 
ON DELETE SET NULL;

-- Verify constraint was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_installment_account'
      AND table_name = 'financial_event_installments'
  ) THEN
    RAISE NOTICE '✅ FK constraint fk_installment_account successfully added';
  ELSE
    RAISE EXCEPTION '❌ FK constraint was not added';
  END IF;
END $$;

COMMIT;

-- Rollback instructions (if needed):
-- ALTER TABLE financial_event_installments DROP CONSTRAINT fk_installment_account;
