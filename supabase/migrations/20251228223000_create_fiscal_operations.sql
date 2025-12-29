-- Create Fiscal Operations Table
CREATE TABLE IF NOT EXISTS public.fiscal_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    tax_group_id UUID NOT NULL REFERENCES public.tax_groups(id) ON DELETE CASCADE,
    destination_state CHAR(2) NOT NULL,
    customer_ie_indicator TEXT NOT NULL CHECK (customer_ie_indicator IN ('contributor', 'exempt', 'non_contributor')),
    customer_is_final_consumer BOOLEAN NOT NULL DEFAULT false,
    operation_type TEXT NOT NULL DEFAULT 'sales' CHECK (operation_type IN ('sales', 'return', 'shipment', 'bonus')),
    
    -- CFOP
    cfop TEXT NOT NULL CHECK (length(cfop) = 4 AND cfop ~ '^[0-9]+$'),
    
    -- ICMS
    icms_cst TEXT,     -- Normal Regime (00, 10, 20, etc)
    icms_csosn TEXT,   -- Simples Nacional (101, 102, etc)
    icms_modal_bc TEXT DEFAULT '3', -- 3=Valor da Operação (Default mostly)
    icms_reduction_bc_percent NUMERIC DEFAULT 0 CHECK (icms_reduction_bc_percent >= 0 AND icms_reduction_bc_percent <= 100),
    icms_rate_percent NUMERIC NOT NULL DEFAULT 0 CHECK (icms_rate_percent >= 0),
    icms_show_in_xml BOOLEAN DEFAULT true,

    -- ICMS-ST
    st_applies BOOLEAN DEFAULT false,
    st_modal_bc TEXT, -- 4=Margem Valor Agregado
    st_mva_percent NUMERIC CHECK (st_mva_percent >= 0),
    st_reduction_bc_percent NUMERIC DEFAULT 0 CHECK (st_reduction_bc_percent >= 0 AND st_reduction_bc_percent <= 100),
    st_rate_percent NUMERIC CHECK (st_rate_percent >= 0),
    st_fcp_percent NUMERIC DEFAULT 0 CHECK (st_fcp_percent >= 0),

    -- PIS
    pis_applies BOOLEAN DEFAULT true,
    pis_cst TEXT, -- 01, 02... 99
    pis_rate_percent NUMERIC DEFAULT 0 CHECK (pis_rate_percent >= 0),

    -- COFINS
    cofins_applies BOOLEAN DEFAULT true,
    cofins_cst TEXT,
    cofins_rate_percent NUMERIC DEFAULT 0 CHECK (cofins_rate_percent >= 0),

    -- IPI
    ipi_applies BOOLEAN DEFAULT false,
    ipi_cst TEXT,
    ipi_rate_percent NUMERIC DEFAULT 0 CHECK (ipi_rate_percent >= 0),

    -- Meta
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Unique Constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_operations_unique_rule ON public.fiscal_operations (
    company_id, 
    tax_group_id, 
    destination_state, 
    customer_ie_indicator, 
    customer_is_final_consumer, 
    operation_type
) WHERE deleted_at IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fiscal_operations_company ON public.fiscal_operations(company_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_operations_tax_group ON public.fiscal_operations(tax_group_id);

-- RLS
ALTER TABLE public.fiscal_operations ENABLE ROW LEVEL SECURITY;

-- Policies (Reuse Company Logic)
CREATE POLICY "Users can view fiscal operations from their company"
    ON public.fiscal_operations FOR SELECT
    USING (company_id IN (
        SELECT company_id 
        FROM public.company_members 
        WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY "Users can insert fiscal operations for their company"
    ON public.fiscal_operations FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id 
        FROM public.company_members 
        WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY "Users can update fiscal operations for their company"
    ON public.fiscal_operations FOR UPDATE
    USING (company_id IN (
        SELECT company_id 
        FROM public.company_members 
        WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY "Users can delete (soft) fiscal operations for their company"
    ON public.fiscal_operations FOR DELETE
    USING (company_id IN (
        SELECT company_id 
        FROM public.company_members 
        WHERE auth_user_id = auth.uid()
    ));

-- Trigger Updated At
CREATE TRIGGER update_fiscal_operations_updated_at
    BEFORE UPDATE ON public.fiscal_operations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
