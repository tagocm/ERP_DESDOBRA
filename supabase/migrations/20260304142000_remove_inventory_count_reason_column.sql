BEGIN;

ALTER TABLE public.inventory_count_lines
    DROP COLUMN IF EXISTS reason;

CREATE OR REPLACE FUNCTION public.post_inventory_count(
    p_inventory_count_id UUID,
    p_posted_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_count public.inventory_counts%ROWTYPE;
    v_line RECORD;
    v_diff NUMERIC(15, 4);
    v_qty_in NUMERIC(15, 4);
    v_qty_out NUMERIC(15, 4);
    v_qty_base NUMERIC(15, 4);
    v_notes TEXT;
    v_posted_items INTEGER := 0;
BEGIN
    SELECT *
      INTO v_count
      FROM public.inventory_counts
     WHERE id = p_inventory_count_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventario nao encontrado';
    END IF;

    IF v_count.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Inventario ja foi postado ou cancelado';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.inventory_movements im
         WHERE im.company_id = v_count.company_id
           AND im.reference_type = 'inventory_count'
           AND im.reference_id = v_count.id
    ) THEN
        RAISE EXCEPTION 'Inventario ja possui movimentos de ajuste lancados';
    END IF;

    FOR v_line IN
        SELECT l.*, i.uom AS item_uom
          FROM public.inventory_count_lines l
          JOIN public.items i
            ON i.id = l.item_id
         WHERE l.inventory_count_id = v_count.id
           AND l.company_id = v_count.company_id
    LOOP
        IF v_line.counted_qty_base IS NULL THEN
            CONTINUE;
        END IF;

        v_diff := COALESCE(v_line.counted_qty_base, 0) - COALESCE(v_line.system_qty_base, 0);

        IF v_diff = 0 THEN
            CONTINUE;
        END IF;

        IF v_diff > 0 THEN
            v_qty_in := v_diff;
            v_qty_out := 0;
            v_qty_base := v_diff;
        ELSE
            v_qty_in := 0;
            v_qty_out := ABS(v_diff);
            v_qty_base := v_diff;
        END IF;

        v_notes := concat_ws(
            ' | ',
            format('Ajuste por inventario #%s', v_count.number),
            NULLIF(v_line.notes, '')
        );

        INSERT INTO public.inventory_movements (
            company_id,
            item_id,
            movement_type,
            qty_base,
            qty_in,
            qty_out,
            qty_display,
            uom_label,
            conversion_factor,
            occurred_at,
            reference_type,
            reference_id,
            reason,
            notes,
            created_by,
            source_ref
        ) VALUES (
            v_count.company_id,
            v_line.item_id,
            'AJUSTE',
            v_qty_base,
            v_qty_in,
            v_qty_out,
            ABS(v_diff),
            v_line.item_uom,
            1,
            v_count.counted_at,
            'inventory_count',
            v_count.id,
            'inventory_count',
            v_notes,
            p_posted_by,
            format('Inventario #%s', v_count.number)
        );

        v_posted_items := v_posted_items + 1;
    END LOOP;

    UPDATE public.inventory_counts
       SET status = 'POSTED',
           posted_by = p_posted_by,
           posted_at = now(),
           updated_at = now()
     WHERE id = v_count.id;

    RETURN jsonb_build_object(
        'inventory_count_id', v_count.id,
        'inventory_count_number', v_count.number,
        'posted_items', v_posted_items,
        'status', 'POSTED'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_inventory_count(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

