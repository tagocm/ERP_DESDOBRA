-- 1. Update Check Constraint to support Production types
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;

ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_movement_type_check
CHECK (movement_type IN ('ENTRADA', 'SAIDA', 'AJUSTE', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 'PRODUCTION_BYPRODUCT_OUTPUT'));

-- 2. Create RPC function for Atomic Production Entry
CREATE OR REPLACE FUNCTION public.register_production_entry(
    p_work_order_id UUID,
    p_qty_produced NUMERIC,
    p_occurred_at TIMESTAMPTZ,
    p_notes TEXT
)
RETURNS VOID AS $$
DECLARE
    v_company_id UUID;
    v_item_id UUID;
    v_bom_id UUID;
    v_bom_yield_qty NUMERIC;
    v_factor NUMERIC;
    r_bom_line RECORD;
    r_bom_bp RECORD;
    v_line_qty_calculated NUMERIC;
    v_current_produced NUMERIC;
    v_new_total_produced NUMERIC;
BEGIN
    -- Get Work Order details and BOM Yield
    SELECT 
        wo.company_id, 
        wo.item_id, 
        wo.bom_id, 
        wo.produced_qty,
        bh.yield_qty
    INTO 
        v_company_id, 
        v_item_id, 
        v_bom_id, 
        v_current_produced,
        v_bom_yield_qty
    FROM public.work_orders wo
    JOIN public.bom_headers bh ON bh.id = wo.bom_id
    WHERE wo.id = p_work_order_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Work Order not found or BOM missing';
    END IF;

    -- Calculate Proportional Factor
    IF v_bom_yield_qty IS NULL OR v_bom_yield_qty <= 0 THEN
        v_bom_yield_qty := 1; -- Fallback to avoid division by zero
    END IF;

    v_factor := p_qty_produced / v_bom_yield_qty;

    -- 1. Consumption (OUT) for Ingredients
    FOR r_bom_line IN
        SELECT component_item_id, qty
        FROM public.bom_lines
        WHERE bom_id = v_bom_id
    LOOP
        v_line_qty_calculated := r_bom_line.qty * v_factor;

        INSERT INTO public.inventory_movements (
            company_id,
            item_id,
            movement_type,
            qty_base,
            qty_out,
            qty_in,
            reference_type,
            reference_id,
            occurred_at,
            notes,
            created_by
        ) VALUES (
            v_company_id,
            r_bom_line.component_item_id,
            'PRODUCTION_CONSUMPTION',
            -1 * v_line_qty_calculated,
            v_line_qty_calculated,
            0,
            'WORK_ORDER',
            p_work_order_id,
            p_occurred_at,
            concat('Consumo por OP #', substring(p_work_order_id::text, 1, 8)),
            auth.uid()
        );
    END LOOP;

    -- 2. Output (IN) for Finished Good
    INSERT INTO public.inventory_movements (
        company_id,
        item_id,
        movement_type,
        qty_base,
        qty_in,
        qty_out,
        reference_type,
        reference_id,
        occurred_at,
        notes,
        created_by
    ) VALUES (
        v_company_id,
        v_item_id,
        'PRODUCTION_OUTPUT',
        p_qty_produced,
        p_qty_produced,
        0,
        'WORK_ORDER',
        p_work_order_id,
        p_occurred_at,
        coalesce(p_notes, concat('Produção OP #', substring(p_work_order_id::text, 1, 8))),
        auth.uid()
    );

    -- 3. Byproducts (IN)
    FOR r_bom_bp IN
        SELECT item_id, qty
        FROM public.bom_byproduct_outputs
        WHERE bom_id = v_bom_id
    LOOP
        v_line_qty_calculated := r_bom_bp.qty * v_factor;

        INSERT INTO public.inventory_movements (
            company_id,
            item_id,
            movement_type,
            qty_base,
            qty_in,
            qty_out,
            reference_type,
            reference_id,
            occurred_at,
            notes,
            created_by
        ) VALUES (
            v_company_id,
            r_bom_bp.item_id,
            'PRODUCTION_BYPRODUCT_OUTPUT',
            v_line_qty_calculated,
            v_line_qty_calculated,
            0,
            'WORK_ORDER',
            p_work_order_id,
            p_occurred_at,
            concat('Co-produto OP #', substring(p_work_order_id::text, 1, 8)),
            auth.uid()
        );
    END LOOP;

    -- 4. Update Work Order
    v_new_total_produced := coalesce(v_current_produced, 0) + p_qty_produced;
    
    UPDATE public.work_orders
    SET 
        produced_qty = v_new_total_produced,
        status = CASE 
            WHEN status = 'planned' THEN 'in_progress'
            ELSE status
        END,
        updated_at = now()
    WHERE id = p_work_order_id;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
