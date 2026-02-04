-- Add index for Singleton Draft Lookup
-- Used in SalesOrderForm.tsx ensureDraftOrder: .eq('sales_rep_id', user.id)

CREATE INDEX IF NOT EXISTS idx_sales_documents_sales_rep_id 
ON public.sales_documents(sales_rep_id);

-- Also add composite index for Draft Lookup specifically
CREATE INDEX IF NOT EXISTS idx_sales_documents_draft_lookup
ON public.sales_documents(company_id, sales_rep_id, status_commercial, doc_type);
