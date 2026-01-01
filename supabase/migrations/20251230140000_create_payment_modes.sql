-- Create payment_modes table
CREATE TABLE IF NOT EXISTS payment_modes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, name)
);

-- RLS
ALTER TABLE payment_modes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment_modes of their company"
    ON payment_modes FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM company_members 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert payment_modes for their company"
    ON payment_modes FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_members 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update payment_modes for their company"
    ON payment_modes FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM company_members 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete payment_modes for their company"
    ON payment_modes FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM company_members 
            WHERE auth_user_id = auth.uid()
        )
    );

-- Populate default values for existing companies (optional but helper)
-- Helper function to seed defaults if needed, but for now we leave empty or let frontend handle seeding.

-- Update organizations table
-- First, drop the text column if it exists or convert it.
-- Since we know it is text and likely empty, we can drop and recreate.
DO $$ 
BEGIN
    -- Check if it is text
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'payment_mode_id' 
        AND data_type = 'text'
    ) THEN
        ALTER TABLE organizations DROP COLUMN payment_mode_id;
        ALTER TABLE organizations ADD COLUMN payment_mode_id UUID REFERENCES payment_modes(id);
    ELSIF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'payment_mode_id'
    ) THEN
        ALTER TABLE organizations ADD COLUMN payment_mode_id UUID REFERENCES payment_modes(id);
    END IF;
END $$;
