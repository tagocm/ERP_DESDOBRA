-- Add new commercial fields to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS payment_mode_id text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS credit_limit numeric(15,2);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_discount numeric(5,2);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sales_channel text;

-- Add index for payment_mode_id if useful for filtering/joins later
CREATE INDEX IF NOT EXISTS idx_organizations_payment_mode_id ON organizations(payment_mode_id);
