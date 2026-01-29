
-- Migration: Fiscal Standardization
-- 1. Create table for tracking document issues (inconsistencies)
-- 2. Create function to reconcile legacy fiscal records

-- 1. Sales Document Issues Table
CREATE TABLE IF NOT EXISTS public.sales_document_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    sales_document_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    
    issue_type TEXT NOT NULL, 
    -- 'FISCAL_GHOST_AUTHORIZATION', 'FISCAL_DIVERGENCE', 'FINANCIAL_ADJUSTMENT_REQUIRED', 'LOGISTIC_DESYNC'
    
    severity TEXT NOT NULL CHECK (severity IN ('BAIXA','MEDIA','ALTA','CRITICA')),
    status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA','RESOLVIDA','IGNORADA')),
    
    payload JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE public.sales_document_issues ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sales_document_issues' 
        AND policyname = 'sales_document_issues_access'
    ) THEN
        CREATE POLICY "sales_document_issues_access" ON public.sales_document_issues
            USING (public.is_member_of(company_id))
            WITH CHECK (public.is_member_of(company_id));
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_issues_doc ON public.sales_document_issues(sales_document_id);
CREATE INDEX IF NOT EXISTS idx_sales_issues_company ON public.sales_document_issues(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_issues_status ON public.sales_document_issues(status);

-- 2. Backfill/Reconciliation Function
CREATE OR REPLACE FUNCTION public.reconcile_fiscal_records()
RETURNS TABLE (
    processed_count INT,
    migrated_count INT,
    ghost_count INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_processed INT := 0;
    v_migrated INT := 0;
    v_ghost INT := 0;
    r_doc RECORD;
    r_legacy RECORD;
    v_exists_emission BOOLEAN;
BEGIN
    -- Iterate over authorized documents
    FOR r_doc IN 
        SELECT id, company_id, document_number, status_fiscal 
        FROM sales_documents 
        WHERE status_fiscal = 'authorized'
    LOOP
        v_processed := v_processed + 1;
        
        -- Check if exists in nfe_emissions (Truth)
        SELECT EXISTS (
            SELECT 1 FROM nfe_emissions 
            WHERE sales_document_id = r_doc.id AND status = 'authorized'
        ) INTO v_exists_emission;
        
        IF NOT v_exists_emission THEN
            -- Check Legacy Table
            SELECT * INTO r_legacy 
            FROM sales_document_nfes 
            WHERE document_id = r_doc.id 
            LIMIT 1;
            
            IF FOUND AND r_legacy.nfe_key IS NOT NULL THEN
                -- Migratable: We have key/data in legacy
                INSERT INTO nfe_emissions (
                    company_id,
                    sales_document_id,
                    access_key,
                    status,
                    tp_amb, -- Defaulting to 1 (Production) or inferring? Legacy table doesn't have env. Assuming 1.
                    numero,
                    serie,
                    xml_signed, -- We might not have this in legacy if not snapshot properly
                    authorized_at
                ) VALUES (
                    r_legacy.company_id,
                    r_doc.id,
                    r_legacy.nfe_key,
                    'authorized',
                    '1', -- Assumption: Legacy authorized notes are production
                    COALESCE(r_legacy.nfe_number::text, '0'),
                    COALESCE(r_legacy.nfe_series::text, '1'),
                    COALESCE((r_legacy.draft_snapshot->>'xml_signed'), ''), -- Try to extract or empty
                    COALESCE(r_legacy.issued_at, NOW())
                )
                ON CONFLICT (company_id, access_key) DO NOTHING;
                
                v_migrated := v_migrated + 1;
            ELSE
                -- Ghost: Authorized but no Key/XML in legacy or Link missing
                INSERT INTO sales_document_issues (
                    company_id,
                    sales_document_id,
                    issue_type,
                    severity,
                    payload
                ) VALUES (
                    r_doc.company_id,
                    r_doc.id,
                    'FISCAL_GHOST_AUTHORIZATION',
                    'CRITICA',
                    jsonb_build_object(
                        'message', 'Document marked authorized but no NF-e record found.',
                        'legacy_record', to_jsonb(r_legacy)
                    )
                );
                
                v_ghost := v_ghost + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_processed, v_migrated, v_ghost;
END;
$$;
