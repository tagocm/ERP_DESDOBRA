-- Migration to add support for co-products (byproducts) in BOM
-- Date: 2025-12-27

CREATE TABLE IF NOT EXISTS public.bom_byproduct_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    bom_id UUID NOT NULL REFERENCES public.bom_headers(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    qty NUMERIC NOT NULL,
    basis TEXT NOT NULL CHECK (basis IN ('PERCENT', 'FIXED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CHECK (qty > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS bom_byproduct_outputs_bom_idx ON public.bom_byproduct_outputs(bom_id);
CREATE INDEX IF NOT EXISTS bom_byproduct_outputs_item_idx ON public.bom_byproduct_outputs(item_id);
CREATE INDEX IF NOT EXISTS bom_byproduct_outputs_company_idx ON public.bom_byproduct_outputs(company_id);

-- RLS
ALTER TABLE public.bom_byproduct_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY bom_byproduct_outputs_select ON public.bom_byproduct_outputs FOR SELECT
    USING (public.is_member_of(company_id));

CREATE POLICY bom_byproduct_outputs_insert ON public.bom_byproduct_outputs FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY bom_byproduct_outputs_update ON public.bom_byproduct_outputs FOR UPDATE
    USING (public.is_member_of(company_id));

CREATE POLICY bom_byproduct_outputs_delete ON public.bom_byproduct_outputs FOR DELETE
    USING (public.is_member_of(company_id));

-- Updated At Trigger
CREATE TRIGGER bom_byproduct_outputs_updated_at BEFORE UPDATE ON public.bom_byproduct_outputs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comments
COMMENT ON TABLE public.bom_byproduct_outputs IS 'Additional outputs (co-products/by-products) generated during production';
COMMENT ON COLUMN public.bom_byproduct_outputs.basis IS 'PERCENT (of yield_qty) or FIXED (quantity per batch)';
