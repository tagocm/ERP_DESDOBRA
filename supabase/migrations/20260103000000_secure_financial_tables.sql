-- Migration: Secure Financial Tables (RLS) - FIXED V2
-- Description: Enforce RLS on CONFIRMED VALID financial tables: ar_titles, ar_installments.
-- Removed: financial_accounts, financial_transactions, financial_postings (tables do not exist in current env).

-- 1. Enable RLS
ALTER TABLE IF EXISTS ar_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ar_installments ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for Direct Tables (containing company_id)

-- ar_titles
DROP POLICY IF EXISTS "Users can view own company ar_titles" ON ar_titles;
CREATE POLICY "Users can view own company ar_titles"
    ON ar_titles FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert own company ar_titles" ON ar_titles;
CREATE POLICY "Users can insert own company ar_titles"
    ON ar_titles FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update own company ar_titles" ON ar_titles;
CREATE POLICY "Users can update own company ar_titles"
    ON ar_titles FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete own company ar_titles" ON ar_titles;
CREATE POLICY "Users can delete own company ar_titles"
    ON ar_titles FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()
        )
    );

-- 3. Create Policies for Nested Tables (ar_installments)
-- ar_installments does NOT have company_id. We must check parent ar_title.

DROP POLICY IF EXISTS "Users can view own company ar_installments" ON ar_installments;
CREATE POLICY "Users can view own company ar_installments"
    ON ar_installments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM ar_titles t
            WHERE t.id = ar_installments.ar_title_id
            AND t.company_id IN (
                SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can update own company ar_installments" ON ar_installments;
CREATE POLICY "Users can update own company ar_installments"
    ON ar_installments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM ar_titles t
            WHERE t.id = ar_installments.ar_title_id
            AND t.company_id IN (
                SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert own company ar_installments" ON ar_installments;
CREATE POLICY "Users can insert own company ar_installments"
    ON ar_installments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM ar_titles t
            WHERE t.id = ar_title_id -- Variable inside WITH CHECK refers to new row
            AND t.company_id IN (
                SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()
            )
        )
    );
