-- Migration: Add NFe Description Snapshots and UOM Standardization
-- Purpose: Enable explicit unit conversion in NFe descriptions with full backward compatibility
-- Strategy: Add nullable snapshot fields to preserve historical data integrity

-- ========================================================================
-- 1. Add Snapshot Fields to sales_document_items
-- ========================================================================

-- These fields capture the packaging/UOM state at the time of sale
-- This prevents description changes when packaging definitions are updated later

ALTER TABLE public.sales_document_items
ADD COLUMN IF NOT EXISTS sales_uom_abbrev_snapshot TEXT,
ADD COLUMN IF NOT EXISTS base_uom_abbrev_snapshot TEXT,
ADD COLUMN IF NOT EXISTS conversion_factor_snapshot NUMERIC,
ADD COLUMN IF NOT EXISTS sales_unit_label_snapshot TEXT;

-- Add helpful comments
COMMENT ON COLUMN public.sales_document_items.sales_uom_abbrev_snapshot IS 'Snapshot of commercial/packaging unit abbreviation at sale time (e.g., "CX", "FD")';
COMMENT ON COLUMN public.sales_document_items.base_uom_abbrev_snapshot IS 'Snapshot of base product unit abbreviation at sale time (e.g., "PC", "KG", "UN")';
COMMENT ON COLUMN public.sales_document_items.conversion_factor_snapshot IS 'Snapshot of packaging.qty_in_base at sale time (how many base units per commercial unit)';
COMMENT ON COLUMN public.sales_document_items.sales_unit_label_snapshot IS 'Human-readable label snapshot (e.g., "CX 12xPC", "Caixa 12 Pacotes")';

-- ========================================================================
-- 2. Add UOM Standardization to item_packaging
-- ========================================================================

-- This allows packaging types to reference the UOMs table for standardized abbreviations
-- Nullable to maintain backward compatibility with existing data

ALTER TABLE public.item_packaging
ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES public.uoms(id);

COMMENT ON COLUMN public.item_packaging.uom_id IS 'Optional reference to standardized UOM (e.g., Box->CX, Pack->PC). Falls back to type-based mapping if null.';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_item_packaging_uom ON public.item_packaging(uom_id) WHERE uom_id IS NOT NULL;

-- ========================================================================
-- 3. Helper Function: Map Packaging Type to UOM Abbreviation (Fallback)
-- ========================================================================

-- This function provides default UOM abbreviations when packaging.uom_id is null
-- Centralizes the type->abbrev mapping logic

CREATE OR REPLACE FUNCTION public.get_default_packaging_uom_abbrev(p_type TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Standard mappings for common packaging types
    RETURN CASE p_type
        WHEN 'BOX' THEN 'CX'
        WHEN 'PACK' THEN 'PC'
        WHEN 'BALE' THEN 'FD'  -- Fardo
        WHEN 'PALLET' THEN 'PL'
        WHEN 'OTHER' THEN 'UN'
        ELSE 'UN'  -- Safe fallback
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.get_default_packaging_uom_abbrev IS 'Provides default UOM abbreviation for packaging type when uom_id is not set';

-- ========================================================================
-- 4. Verification & Documentation
-- ========================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'NFe Description Snapshots Migration';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Added to sales_document_items:';
    RAISE NOTICE '  - sales_uom_abbrev_snapshot';
    RAISE NOTICE '  - base_uom_abbrev_snapshot';
    RAISE NOTICE '  - conversion_factor_snapshot';
    RAISE NOTICE '  - sales_unit_label_snapshot';
    RAISE NOTICE '';
    RAISE NOTICE 'Added to item_packaging:';
    RAISE NOTICE '  - uom_id (nullable, for standardization)';
    RAISE NOTICE '';
    RAISE NOTICE 'All fields are NULLABLE for backward compatibility';
    RAISE NOTICE 'Existing orders will resolve via join fallback';
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
