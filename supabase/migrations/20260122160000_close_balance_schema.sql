
-- Migration: Close Balance Schema
-- Creates table to track item quantity reductions (cuts) and audit trail

CREATE TABLE IF NOT EXISTS public.sales_document_item_cuts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    sales_document_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    sales_document_item_id UUID NOT NULL REFERENCES public.sales_document_items(id) ON DELETE CASCADE,
    
    qty_cut NUMERIC(15,4) NOT NULL CHECK (qty_cut > 0),
    
    -- Snapshots for audit
    unit_price_snapshot NUMERIC(15,4),
    discount_snapshot NUMERIC(15,2),
    total_cut_snapshot NUMERIC(15,2), -- Value removed from order total
    
    reason_id UUID, -- Could be text or FK to reasons table
    note TEXT,
    
    client_request_id UUID, -- For idempotency
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_item_cuts_doc ON public.sales_document_item_cuts(sales_document_id);
CREATE INDEX IF NOT EXISTS idx_item_cuts_item ON public.sales_document_item_cuts(sales_document_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_cuts_request_id ON public.sales_document_item_cuts(client_request_id) WHERE client_request_id IS NOT NULL;

-- RLS
ALTER TABLE public.sales_document_item_cuts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sales_document_item_cuts' 
        AND policyname = 'sales_item_cuts_access'
    ) THEN
        CREATE POLICY "sales_item_cuts_access" ON public.sales_document_item_cuts
            USING (public.is_member_of(company_id))
            WITH CHECK (public.is_member_of(company_id));
    END IF;
END $$;

-- Add CHECK constraint to issue types if not fully dynamic (Optional, but good for docs)
-- ALTER TABLE sales_document_issues DROP CONSTRAINT IF EXISTS sales_document_issues_issue_type_check; (Skip, assuming text)
