-- Migration: Fix Payment Modes RLS
-- Description: Updates RLS policies for payment_modes to use the is_member_of function for better security and reliability.

-- Enable RLS (just to be sure)
ALTER TABLE payment_modes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view payment_modes of their company" ON payment_modes;
DROP POLICY IF EXISTS "Users can insert payment_modes for their company" ON payment_modes;
DROP POLICY IF EXISTS "Users can update payment_modes for their company" ON payment_modes;
DROP POLICY IF EXISTS "Users can delete payment_modes for their company" ON payment_modes;

-- Create new robust policies using is_member_of()

CREATE POLICY "Users can view payment_modes of their company"
    ON payment_modes FOR SELECT
    USING (public.is_member_of(company_id));

CREATE POLICY "Users can insert payment_modes for their company"
    ON payment_modes FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Users can update payment_modes for their company"
    ON payment_modes FOR UPDATE
    USING (public.is_member_of(company_id))
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Users can delete payment_modes for their company"
    ON payment_modes FOR DELETE
    USING (public.is_member_of(company_id));
