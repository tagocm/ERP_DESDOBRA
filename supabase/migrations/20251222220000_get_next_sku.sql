-- Function to get the next available numeric SKU
CREATE OR REPLACE FUNCTION public.get_next_sku(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_sku INT;
BEGIN
    SELECT COALESCE(MAX(CAST(sku AS INTEGER)), 0) + 1
    INTO v_next_sku
    FROM public.items
    WHERE company_id = p_company_id
    AND sku ~ '^[0-9]+$'; -- Only consider numeric SKUs

    RETURN CAST(v_next_sku AS TEXT);
END;
$$;
