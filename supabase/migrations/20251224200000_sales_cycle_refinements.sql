-- Migration: Sales Cycle Refinements
-- Description: Adds columns for soft delete, fulfillment tracking, and creates adjustments table.

-- 1. Update sales_documents
ALTER TABLE sales_documents 
ADD COLUMN IF NOT EXISTS invoiced_at timestamptz,
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS delete_reason text,
ADD COLUMN IF NOT EXISTS financial_status text DEFAULT 'pending';

-- Index for soft delete filtering
CREATE INDEX IF NOT EXISTS idx_sales_documents_deleted_at ON sales_documents(deleted_at);


-- 2. Update sales_document_items
ALTER TABLE sales_document_items
ADD COLUMN IF NOT EXISTS qty_fulfilled numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS qty_invoiced numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS qty_returned numeric DEFAULT 0;


-- 3. Create sales_document_adjustments table
CREATE TABLE IF NOT EXISTS sales_document_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    sales_document_id uuid NOT NULL REFERENCES sales_documents(id),
    type text NOT NULL, -- 'credit', 'debit', 'return'
    amount numeric NOT NULL,
    reason text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_adjustments_company ON sales_document_adjustments(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_adjustments_doc ON sales_document_adjustments(sales_document_id);

-- RLS Policies
ALTER TABLE sales_document_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view adjustments for their company"
    ON sales_document_adjustments
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id 
            FROM company_members 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert adjustments for their company"
    ON sales_document_adjustments
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id 
            FROM company_members 
            WHERE auth_user_id = auth.uid()
        )
    );

-- 4. Note: Existing policies on sales_documents and sales_document_items 
-- should already cover the new columns since they likely use 'true' for Updates 
-- or verify company_id, which hasn't changed.
