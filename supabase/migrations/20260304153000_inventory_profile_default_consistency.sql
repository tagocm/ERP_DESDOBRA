BEGIN;

-- Backfill: garante perfil de estoque para itens ativos sem profile legado.
INSERT INTO public.item_inventory_profiles (
    company_id,
    item_id,
    control_stock,
    min_stock,
    max_stock,
    reorder_point,
    default_location,
    control_batch,
    control_expiry,
    created_at,
    updated_at
)
SELECT
    i.company_id,
    i.id,
    true,
    0,
    NULL,
    0,
    NULL,
    false,
    false,
    now(),
    now()
FROM public.items i
LEFT JOIN public.item_inventory_profiles p
    ON p.item_id = i.id
WHERE i.deleted_at IS NULL
  AND p.item_id IS NULL
ON CONFLICT (item_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_item_inventory_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.item_inventory_profiles (
        company_id,
        item_id,
        control_stock,
        min_stock,
        max_stock,
        reorder_point,
        default_location,
        control_batch,
        control_expiry,
        created_at,
        updated_at
    )
    VALUES (
        NEW.company_id,
        NEW.id,
        true,
        0,
        NULL,
        0,
        NULL,
        false,
        false,
        now(),
        now()
    )
    ON CONFLICT (item_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_item_inventory_profile ON public.items;
CREATE TRIGGER trg_ensure_item_inventory_profile
    AFTER INSERT ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_item_inventory_profile();

NOTIFY pgrst, 'reload schema';

COMMIT;

