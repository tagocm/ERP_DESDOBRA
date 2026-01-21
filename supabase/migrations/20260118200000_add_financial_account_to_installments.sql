-- ========================================================================
-- Add Financial Account to Installments
-- ========================================================================
-- Purpose: Add financial_account_id (bank account) to installment tables
--          to allow tracking which bank account should be used for payments
-- ========================================================================

-- 1. Add to financial_event_installments (pre-approval)
ALTER TABLE financial_event_installments 
ADD COLUMN IF NOT EXISTS financial_account_id UUID REFERENCES company_bank_accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN financial_event_installments.financial_account_id IS 'Bank account to use for this installment payment';

-- 2. Add to ar_installments (receivables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ar_installments' AND column_name = 'financial_account_id'
  ) THEN
    ALTER TABLE ar_installments 
    ADD COLUMN financial_account_id UUID REFERENCES company_bank_accounts(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN ar_installments.financial_account_id IS 'Bank account where payment should be received';
  END IF;
END $$;

-- 3. Add to ap_installments (payables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ap_installments' AND column_name = 'financial_account_id'
  ) THEN
    ALTER TABLE ap_installments 
    ADD COLUMN financial_account_id UUID REFERENCES company_bank_accounts(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN ap_installments.financial_account_id IS 'Bank account from which payment should be made';
  END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_event_installments_account 
ON financial_event_installments(financial_account_id);

CREATE INDEX IF NOT EXISTS idx_ar_installments_account 
ON ar_installments(financial_account_id);

CREATE INDEX IF NOT EXISTS idx_ap_installments_account 
ON ap_installments(financial_account_id);
