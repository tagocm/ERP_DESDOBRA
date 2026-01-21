-- Migration: Auto Stock Deduction (Baixa Automática)
-- Description: Triggers inventory deduction when sales order enters "em_rota".

-- 1. Ensure columns exist (Mapping prompt "source_type" -> existing "reference_type", etc.)
DO $$
BEGIN
    -- Ensure reference_type (source_type)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'reference_type') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN reference_type TEXT;
    END IF;

    -- Ensure reference_id (source_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'reference_id') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN reference_id UUID;
    END IF;

    -- Add source_ref (as requested by user "source_ref")
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'source_ref') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN source_ref TEXT;
    END IF;
END $$;


-- 2. Function to handle stock deduction
CREATE OR REPLACE FUNCTION public.handle_sales_order_logistic_change_stock()
RETURNS TRIGGER AS $$
DECLARE
    r_item RECORD;
    v_qty NUMERIC;
    v_source_ref TEXT;
BEGIN
    -- Conditions:
    -- 1. Must be an Order
    -- 2. New status must be 'em_rota' (logistics_status enum or text)
    --    Note: status_logistic type might be enum, we cast to text to be safe
    IF NEW.doc_type = 'order' AND NEW.status_logistic::text = 'em_rota' THEN
        
        -- Idempotency Check:
        -- Check if we already have movements for this order
        IF EXISTS (
            SELECT 1 FROM public.inventory_movements 
            WHERE reference_type = 'pedido' 
            AND reference_id = NEW.id 
            AND movement_type = 'SAIDA'
        ) THEN
            RETURN NEW;
        END IF;

        -- Prepare Reference
        v_source_ref := concat('#', NEW.document_number);

        -- Loop items and insert movements
        FOR r_item IN 
            SELECT * FROM public.sales_document_items WHERE document_id = NEW.id
        LOOP
            -- Calculate Quantity (Use base if available, fallback to quantity)
            -- Note: qty_base is checked dynamically. If column doesn't exist, this might fail unless we ensure it exists or use jsonb.
            -- However, assuming schema is up to date with qty_base.
            v_qty := COALESCE(r_item.qty_base, r_item.quantity);

            -- Insert Movement
            INSERT INTO public.inventory_movements (
                company_id,
                item_id,
                movement_type,
                qty_base,
                reference_type, -- source_type
                reference_id,   -- source_id
                source_ref,
                notes,
                created_by,
                created_at,
                updated_at,
                reason,
                qty_in,
                qty_out
            ) VALUES (
                NEW.company_id,
                r_item.item_id,
                'SAIDA',
                v_qty,
                'pedido',
                NEW.id,
                v_source_ref,
                'Baixa automática ao entrar em rota',
                NULL, -- sales_documents doesn't have updated_by, leaving null
                NOW(),
                NOW(),
                'sale_out', -- reason (legacy/required)
                0,          -- qty_in
                v_qty       -- qty_out
            );
        END LOOP;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_sales_order_logistic_change_stock ON public.sales_documents;
CREATE TRIGGER trg_sales_order_logistic_change_stock
    AFTER UPDATE OF status_logistic ON public.sales_documents
    FOR EACH ROW
    WHEN (OLD.status_logistic IS DISTINCT FROM NEW.status_logistic)
    EXECUTE FUNCTION public.handle_sales_order_logistic_change_stock();
