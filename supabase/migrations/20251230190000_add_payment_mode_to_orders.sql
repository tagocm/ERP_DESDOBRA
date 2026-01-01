ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS payment_mode_id UUID REFERENCES payment_modes(id);
CREATE INDEX IF NOT EXISTS idx_sales_documents_payment_mode_id ON sales_documents(payment_mode_id);
