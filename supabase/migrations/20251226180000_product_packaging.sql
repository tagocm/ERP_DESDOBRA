-- Migration: Product Packaging Support
-- 1. Rename base GTIN column in items
-- 2. Add base weight fields to items
-- 3. Create item_packaging table

-- 1. Alter items table
ALTER TABLE public.items 
RENAME COLUMN gtin TO gtin_ean_base;

ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS net_weight_g_base NUMERIC,
ADD COLUMN IF NOT EXISTS gross_weight_g_base NUMERIC;

COMMENT ON COLUMN public.items.gtin_ean_base IS 'GTIN/EAN for the base unit (UOM)';
COMMENT ON COLUMN public.items.net_weight_g_base IS 'Net weight in grams for the base unit';
COMMENT ON COLUMN public.items.gross_weight_g_base IS 'Gross weight in grams for the base unit';

-- 2. Create item_packaging table
CREATE TABLE IF NOT EXISTS public.item_packaging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL CHECK (type IN ('BOX', 'PACK', 'BALE', 'PALLET', 'OTHER')),
    label TEXT NOT NULL, -- e.g. "Caixa 12x1kg"
    qty_in_base NUMERIC NOT NULL CHECK (qty_in_base > 0),
    
    gtin_ean TEXT,
    net_weight_g NUMERIC,
    gross_weight_g NUMERIC,
    
    is_default_sales_unit BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    
    -- Constraint: Only one default sales unit per item (partial index below is better or check constraint)
    CONSTRAINT positive_weights CHECK (
        (net_weight_g IS NULL OR net_weight_g >= 0) AND
        (gross_weight_g IS NULL OR gross_weight_g >= 0)
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_item_packaging_item ON public.item_packaging(item_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_item_packaging_company ON public.item_packaging(company_id);
CREATE INDEX IF NOT EXISTS idx_item_packaging_gtin ON public.item_packaging(gtin_ean);

-- Trigger for updated_at
CREATE TRIGGER update_item_packaging_updated_at
    BEFORE UPDATE ON public.item_packaging
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- RLS Policies
ALTER TABLE public.item_packaging ENABLE ROW LEVEL SECURITY;

CREATE POLICY item_packaging_select ON public.item_packaging FOR SELECT
    USING (public.is_member_of(company_id));

CREATE POLICY item_packaging_insert ON public.item_packaging FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY item_packaging_update ON public.item_packaging FOR UPDATE
    USING (public.is_member_of(company_id));

CREATE POLICY item_packaging_delete ON public.item_packaging FOR DELETE
    USING (public.is_member_of(company_id));

-- Comments
COMMENT ON TABLE public.item_packaging IS 'Alternative packagings for items (e.g. Boxes, Packs)';
COMMENT ON COLUMN public.item_packaging.qty_in_base IS 'Quantity of base units contained in this package';
COMMENT ON COLUMN public.item_packaging.type IS 'BOX, PACK, BALE, PALLET, OTHER';
