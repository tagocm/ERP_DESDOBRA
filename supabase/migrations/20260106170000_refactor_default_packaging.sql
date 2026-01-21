-- 1. Unique index for default packaging
CREATE UNIQUE INDEX IF NOT EXISTS ux_item_packaging_one_default
ON public.item_packaging (company_id, item_id)
WHERE is_default_sales_unit = true AND deleted_at IS NULL;

-- 2. Lookup index
CREATE INDEX IF NOT EXISTS ix_item_packaging_default_lookup
ON public.item_packaging (company_id, item_id, is_default_sales_unit, created_at)
WHERE deleted_at IS NULL AND is_active = true;

-- 3. RPC to set default packaging
CREATE OR REPLACE FUNCTION public.set_default_packaging(p_company_id uuid, p_item_id uuid, p_packaging_id uuid)
RETURNS VOID AS $$
BEGIN
    -- Verify ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.item_packaging
        WHERE id = p_packaging_id AND item_id = p_item_id AND company_id = p_company_id
    ) THEN
        RAISE EXCEPTION 'Packaging not found or does not belong to item';
    END IF;

    -- Unset current defaults (for this item)
    UPDATE public.item_packaging
    SET is_default_sales_unit = false
    WHERE company_id = p_company_id
      AND item_id = p_item_id
      AND is_default_sales_unit = true
      AND id != p_packaging_id; -- Optimization: don't touch if it's the same (though user might want to ensure it IS true)

    -- Set new default
    UPDATE public.item_packaging
    SET is_default_sales_unit = true
    WHERE id = p_packaging_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
