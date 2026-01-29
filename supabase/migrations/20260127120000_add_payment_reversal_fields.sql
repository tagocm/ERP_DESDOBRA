
-- Add status and reversal tracking to AR Payments
ALTER TABLE ar_payments 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, REVERSED
ADD COLUMN IF NOT EXISTS original_payment_id uuid REFERENCES ar_payments(id),
ADD COLUMN IF NOT EXISTS reversal_reason text;

CREATE INDEX IF NOT EXISTS idx_ar_payments_status ON ar_payments(status);
CREATE INDEX IF NOT EXISTS idx_ar_payments_original ON ar_payments(original_payment_id);

-- Add status and reversal tracking to AP Payments
ALTER TABLE ap_payments 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, REVERSED
ADD COLUMN IF NOT EXISTS original_payment_id uuid REFERENCES ap_payments(id),
ADD COLUMN IF NOT EXISTS reversal_reason text;

CREATE INDEX IF NOT EXISTS idx_ap_payments_status ON ap_payments(status);
CREATE INDEX IF NOT EXISTS idx_ap_payments_original ON ap_payments(original_payment_id);
